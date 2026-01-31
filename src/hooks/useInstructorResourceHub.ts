'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export type ResourceTab = 'video' | 'zoom' | 'materials';
export type SortModeInstructor = 'latest' | 'recommended';

type InstructorResource = {
  id: string;
  kind: ResourceTab; // video | zoom | materials
  title: string;
  comment?: string | null;
  url: string;
  is_active: boolean;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const FAVORITES_TABLE = 'resource_favorites';

export function useInstructorResourceHub(profile?: any) {
  const userId = profile?.user_id ?? null; // ✅ profiles.user_id (= auth.uid)
  const isAdmin = (profile as any)?.role === 'admin';
  const isInstructor = (profile as any)?.role === 'instructor';

  // ✅ 강사전용 찜 scope
const favScope = 'instructor' as const;

  // tabs
  const [resourceTab, setResourceTab] = useState<ResourceTab>('video');

  // sorting
  const [sortMode, setSortMode] = useState<SortModeInstructor>('latest');
  const [sortOpen, setSortOpen] = useState(false);
  const sortWrapRef = useRef<HTMLDivElement | null>(null);

  // favorites
  const [favSet, setFavSet] = useState<Set<string>>(new Set());
  const [favCountMap, setFavCountMap] = useState<Record<string, number>>({});
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // data
  const [items, setItems] = useState<InstructorResource[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ key helper (강사전용도 동일 키 구조로 통일)
  const favKey = useCallback(
    (itemId: string, kind: ResourceTab) => `${favScope}:${itemId}:${kind}`,
    []
  );

  // outside click close
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!sortWrapRef.current) return;
      if (!sortWrapRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // ✅ 강사전용 리소스 로드
  useEffect(() => {
    const run = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('instructor_resources')
        .select('id, kind, title, comment, url, is_active, sort_order, created_at, updated_at')
        .eq('is_active', true);

      setLoading(false);

      if (error) {
        console.error('instructor_resources load error:', error);
        return;
      }

      setItems((data ?? []) as InstructorResource[]);
    };

    run();
  }, []);

  const itemIds = useMemo(() => items.map((x) => x.id), [items]);
  const itemIdsKey = useMemo(() => itemIds.join(','), [itemIds]);

  // ✅ favorites 초기 로딩(내 찜 + 전체 카운트)
  useEffect(() => {
    const run = async () => {
      if (!userId) return;
      if (!itemIds.length) return;

      // 1) 내가 찜한 것
      const { data: myFavs, error: myErr } = await supabase
        .from(FAVORITES_TABLE)
        .select('item_id, kind')
        .eq('user_id', userId)
        .eq('scope', favScope)
        .in('item_id', itemIds);

      if (myErr) {
        console.error('instructor favorites load error:', myErr);
        return;
      }

      const nextSet = new Set<string>();
      (myFavs ?? []).forEach((r: any) => {
        if (!r?.item_id || !r?.kind) return;
        nextSet.add(favKey(r.item_id, r.kind));
      });
      setFavSet(nextSet);

      // 2) 전체 찜 카운트(추천순용)
      const { data: counts, error: cntErr } = await supabase
        .from('resource_favorite_counts')
        .select('item_id, kind, cnt')
        .eq('scope', favScope)
        .in('item_id', itemIds);

      if (cntErr) {
        console.error('instructor favorite counts load error:', cntErr);
        return;
      }

      const nextCount: Record<string, number> = {};
      (counts ?? []).forEach((r: any) => {
        if (!r?.item_id || !r?.kind) return;
        nextCount[favKey(r.item_id, r.kind)] = Number(r.cnt ?? 0);
      });
      setFavCountMap(nextCount);
    };

    run();
  }, [userId, favScope, itemIdsKey, favKey]);

  // ✅ 찜 토글
  const toggleFavorite = useCallback(
    async (itemId: string, kind: ResourceTab) => {
      if (!userId) {
        alert('찜 기능은 로그인 후 사용할 수 있어요.');
        return;
      }

      const key = favKey(itemId, kind);
      const isFav = favSet.has(key);

      // UI optimistic
      setFavSet((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(key);
        else next.add(key);
        return next;
      });

      setFavCountMap((prev) => ({
        ...prev,
        [key]: Math.max(0, (prev[key] ?? 0) + (isFav ? -1 : 1)),
      }));

      try {
        if (isFav) {
          await supabase
            .from(FAVORITES_TABLE)
            .delete()
            .eq('user_id', userId)
            .eq('scope', favScope)
            .eq('item_id', itemId)
            .eq('kind', kind);
        } else {
          await supabase.from(FAVORITES_TABLE).insert({
            user_id: userId,
            scope: favScope,
            item_id: itemId,
            kind,
          });
        }
      } catch (e) {
        console.error('instructor favorite toggle failed', e);
      }
    },
    [userId, favScope, favKey, favSet]
  );

  // openLink (강사전용은 그냥 새탭)
  const openLink = useCallback((s: InstructorResource) => {
    if (!s?.url) return;
    window.open(s.url, '_blank', 'noopener,noreferrer');
  }, []);

  // rows: 탭/찜필터/정렬 적용
  const rows = useMemo(() => {
    let filtered = (items ?? []).filter((x) => x.kind === resourceTab);

    // ✅ 내 찜만 보기
    if (onlyFavorites) {
      filtered = filtered.filter((x) => favSet.has(favKey(x.id, resourceTab)));
    }

    if (sortMode === 'latest') {
      // 최신 업로드(created_at desc) → 없으면 updated_at → 그래도 없으면 sort_order desc
      filtered = [...filtered].sort((a, b) => {
        const ta = new Date(a.created_at ?? a.updated_at ?? 0).getTime();
        const tb = new Date(b.created_at ?? b.updated_at ?? 0).getTime();
        if (tb !== ta) return tb - ta;
        return Number(b.sort_order ?? 0) - Number(a.sort_order ?? 0);
      });
    } else {
      // 추천순(찜 많은 순)
      filtered = [...filtered].sort((a, b) => {
        const ka = favKey(a.id, resourceTab);
        const kb = favKey(b.id, resourceTab);
        const ca = favCountMap[ka] ?? 0;
        const cb = favCountMap[kb] ?? 0;
        if (cb !== ca) return cb - ca;

        const ta = new Date(a.created_at ?? a.updated_at ?? 0).getTime();
        const tb = new Date(b.created_at ?? b.updated_at ?? 0).getTime();
        return tb - ta;
      });
    }

    return filtered.map((s) => {
      const key = favKey(s.id, resourceTab);
      return { s, favCount: favCountMap[key] ?? 0 };
    });
  }, [items, resourceTab, onlyFavorites, favSet, favKey, sortMode, favCountMap]);

  const tabTitle =
    resourceTab === 'video' ? '강사전용 영상' : resourceTab === 'zoom' ? '강사전용 Zoom' : '강사전용 자료';

  const nowCtaText =
    resourceTab === 'video' ? '영상 열기' : resourceTab === 'zoom' ? '줌 열기' : '자료 열기';

  return {
    // auth
    isAdmin,
    isInstructor,
    loading,

    // tabs
    resourceTab,
    setResourceTab,

    // sorting
    sortMode,
    setSortMode,
    sortOpen,
    setSortOpen,
    sortWrapRef,

    // data
    rows,

    // favorites
    favSet,
    favCountMap,
    onlyFavorites,
    setOnlyFavorites,
    toggleFavorite,

    // actions
    openLink,

    // labels
    tabTitle,
    nowCtaText,
  favKey,

  };
}