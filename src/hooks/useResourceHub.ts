'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export type WatchStatus = 'before' | 'watching' | 'done';
export type SortModeStudent = 'nearest' | 'recommended';
export type ResourceTab = 'video' | 'zoom' | 'materials';

type ProgressRow = { percent: number; lastOpenedAt?: number };

type HubOptions = {
  profile: any;
  sessions: any[];
};

const PROGRESS_TABLE = 'resource_progress';
const WATCH_TABLE = 'resource_watch_status';
const FAVORITES_TABLE = 'resource_favorites';

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useResourceHub({ sessions, profile }: HubOptions) {
  const userId = profile?.user_id ?? null; // ✅ profiles.user_id (= auth.uid)
  const isAdmin = (profile as any)?.role === 'admin';
  const isInstructor = (profile as any)?.role === 'instructor';

  // tabs
  const [resourceTab, setResourceTab] = useState<ResourceTab>('video');
  const [watchTab, setWatchTab] = useState<WatchStatus>('before');

  // sorting
  const [sortMode, setSortMode] = useState<SortModeStudent>('nearest');
  const [sortOpen, setSortOpen] = useState(false);
  const sortWrapRef = useRef<HTMLDivElement | null>(null);

  // local progress
  const LS_KEY = 'video_progress_v1';
  const [progressMap, setProgressMap] = useState<Record<string, ProgressRow>>({});

  // watch status
  const [watchMap, setWatchMap] = useState<Record<string, WatchStatus>>({});

// ---------- favorites (강의실) ----------
const [favSet, setFavSet] = useState<Set<string>>(new Set());
const [favCountMap, setFavCountMap] = useState<Record<string, number>>({});
const [onlyFavorites, setOnlyFavorites] = useState(false);

// ✅ scope 고정 (강의실 = session)
const favScope = 'session' as const;

// ✅ key helper
const favKey = useCallback((itemId: string, kind: ResourceTab) => {
  return `${favScope}:${itemId}:${kind}`;
}, []);

// ✅ session ids
const sessionIds = useMemo(
  () => (sessions ?? []).map((s: any) => s?.id).filter(Boolean),
  [sessions]
);
const sessionIdsKey = useMemo(() => sessionIds.join(','), [sessionIds]);

// ✅ favorites 로딩 함수 (핵심)
useEffect(() => {
  if (!userId) return;
  if (!sessionIds.length) return;

  let alive = true;

  const run = async () => {
    // 1) 내가 찜한 것
    const { data: myFavs, error: myErr } = await supabase
      .from(FAVORITES_TABLE)
      .select('item_id, kind')
      .eq('user_id', userId)
      .eq('scope', favScope)
      .in('item_id', sessionIds);

    if (!alive) return;
    if (myErr) {
      console.error('[favorites] load mine error:', myErr);
      return;
    }

    const nextSet = new Set<string>();
    (myFavs ?? []).forEach((r: any) => {
      if (!r?.item_id || !r?.kind) return;
      nextSet.add(favKey(r.item_id, r.kind));
    });
    setFavSet(nextSet);

    // 2) 전체 찜 카운트
    const { data: counts, error: cntErr } = await supabase
      .from('resource_favorite_counts')
      .select('item_id, kind, cnt')
      .eq('scope', favScope)
      .in('item_id', sessionIds);

    if (!alive) return;
    if (cntErr) {
      console.error('[favorites] load counts error:', cntErr);
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

  return () => {
    alive = false;
  };
}, [userId, sessionIdsKey, favScope, favKey]);

// ✅ 찜 토글 (DB 실패 시 UI 원복 + 성공 시 재동기화)
const toggleFavorite = useCallback(
  async (itemId: string, kind: ResourceTab) => {
    if (!userId) {
      alert('찜 기능은 로그인 후 사용할 수 있어요.');
      return;
    }

    const key = favKey(itemId, kind);
    const wasFav = favSet.has(key);

    // optimistic UI
    setFavSet((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(key);
      else next.add(key);
      return next;
    });

    setFavCountMap((prev) => ({
      ...prev,
      [key]: Math.max(0, (prev[key] ?? 0) + (wasFav ? -1 : 1)),
    }));

    let dbError: any = null;

    if (wasFav) {
      const { error } = await supabase
        .from(FAVORITES_TABLE)
        .delete()
        .eq('user_id', userId)
        .eq('scope', favScope)
        .eq('item_id', itemId)
        .eq('kind', kind);
      dbError = error;
    } else {
      const { error } = await supabase.from(FAVORITES_TABLE).insert({
        user_id: userId,
        scope: favScope,
        item_id: itemId,
        kind,
      });
      dbError = error;
    }

    // ❌ DB 실패 → UI 원복
    if (dbError) {
      console.error('[favorites] db error:', dbError);

      setFavSet((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(key);
        else next.delete(key);
        return next;
      });

      setFavCountMap((prev) => ({
        ...prev,
        [key]: Math.max(0, (prev[key] ?? 0) + (wasFav ? 1 : -1)),
      }));

      return;
    }

  },
  [userId, favKey, favSet]
);

  // URL helper
  const getUrl = useCallback((s: any, tab: ResourceTab) => {
    if (tab === 'video') return s?.classroom_url ?? '';
    if (tab === 'zoom') return s?.zoom_url ?? '';
    return s?.materials_url ?? '';
  }, []);

  // outside click close
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!sortWrapRef.current) return;
      if (!sortWrapRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // load local progress
  useEffect(() => {
    const local = safeJsonParse<Record<string, ProgressRow>>(localStorage.getItem(LS_KEY), {});
    setProgressMap(local);
  }, []);

  const saveProgressLocal = useCallback((map: Record<string, ProgressRow>) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(map));
    } catch {}
  }, []);

  // progress merge from DB
  useEffect(() => {
    const run = async () => {
      if (!userId) return;
      if (!sessionIds.length) return;

      const { data, error } = await supabase
        .from(PROGRESS_TABLE)
        .select('session_id, percent, last_opened_at')
        .eq('user_id', userId)
        .in('session_id', sessionIds);

      if (error) return;

      const next: Record<string, ProgressRow> = { ...(progressMap ?? {}) };
      (data ?? []).forEach((r: any) => {
        const sid = r.session_id;
        const percent = Number(r.percent ?? 0);
        const lastOpenedAt = r.last_opened_at ? new Date(r.last_opened_at).getTime() : 0;

        const cur = next[sid];
        if (!cur || (lastOpenedAt || 0) >= (cur.lastOpenedAt || 0)) {
          next[sid] = { percent, lastOpenedAt };
        }
      });

      setProgressMap(next);
      saveProgressLocal(next);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sessionIds.join(',')]);

  const upsertProgress = useCallback(
    async (sessionId: string, next: ProgressRow) => {
      setProgressMap((prev) => {
        const out = { ...prev, [sessionId]: next };
        saveProgressLocal(out);
        return out;
      });

      if (!userId) return;

      await supabase.from(PROGRESS_TABLE).upsert(
        {
          user_id: userId,
          session_id: sessionId,
          percent: Math.max(0, Math.min(100, Number(next.percent ?? 0))),
          last_opened_at: next.lastOpenedAt ? new Date(next.lastOpenedAt).toISOString() : null,
        },
        { onConflict: 'user_id,session_id' }
      );
    },
    [saveProgressLocal, userId]
  );

  // ✅ 진행률 touch (모달/새탭 열기 모두에서 최소 5%+시간 갱신)
  const touchProgress = useCallback(
    (sessionId: string) => {
      const curP = progressMap[sessionId]?.percent ?? 0;
      const nextP = curP > 0 ? curP : 5;
      upsertProgress(sessionId, { percent: nextP, lastOpenedAt: Date.now() });
    },
    [progressMap, upsertProgress]
  );

  // watch status load
  useEffect(() => {
    const run = async () => {
      if (!userId) return;
      if (!sessionIds.length) return;

      const { data, error } = await supabase
        .from(WATCH_TABLE)
        .select('session_id,status')
        .eq('user_id', userId)
        .eq('kind', 'video') // ✅ 강의실 watch는 video만 관리
        .in('session_id', sessionIds);

      if (error) return;

      const m: Record<string, WatchStatus> = {};
      (data ?? []).forEach((r: any) => {
        m[r.session_id] = (r.status ?? 'before') as WatchStatus;
      });
      setWatchMap(m);
    };

    run();
  }, [userId, sessionIds.join(',')]);

  const setWatchStatus = useCallback(
    async (sessionId: string, next: WatchStatus) => {
      setWatchMap((prev) => ({ ...prev, [sessionId]: next }));

      if (!userId) return;

      const { error } = await supabase.from(WATCH_TABLE).upsert(
        {
          user_id: userId,
          session_id: sessionId,
          kind: 'video', // ✅
          status: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,session_id,kind' }
      );

      if (error) {
        console.error('watch status save error', error);
      }
    },
    [userId]
  );

  // ✅ 이어보기 (watching + lastOpenedAt)
  const continueList = useMemo(() => {
    const list = (sessions ?? [])
      .filter((s: any) => Boolean(getUrl(s, 'video')))
      .filter((s: any) => (watchMap[s.id] ?? 'before') === 'watching')
      .map((s: any) => {
        const p = progressMap[s.id]?.percent ?? 0;
        const last = progressMap[s.id]?.lastOpenedAt ?? 0;
        return { s, percent: Math.max(p, 5), lastOpenedAt: last };
      })
      .sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
    return list;
  }, [getUrl, progressMap, sessions, watchMap]);

  // ✅ topNow
  const topNow = useMemo(() => {
    if (resourceTab !== 'video') return null;

    const videoSessions = (sessions ?? []).filter((s: any) => Boolean(getUrl(s, 'video')));
    if (!videoSessions.length) return null;

    if (continueList[0]) return continueList[0].s;

    const progressed = videoSessions
      .map((s: any) => ({
        s,
        percent: progressMap[s.id]?.percent ?? 0,
        lastOpenedAt: progressMap[s.id]?.lastOpenedAt ?? 0,
      }))
      .filter((x) => x.percent > 0)
      .sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));

    if (progressed[0]) return progressed[0].s;
    return videoSessions[0];
  }, [continueList, getUrl, progressMap, resourceTab, sessions]);

  // ✅ videoCounts (시청칩 표시용)
  const videoCounts = useMemo(() => {
    const videoSessions = (sessions ?? []).filter((s: any) => Boolean(getUrl(s, 'video')));
    const c: Record<WatchStatus, number> = { before: 0, watching: 0, done: 0 };

    videoSessions.forEach((s: any) => {
      const st = (watchMap[s.id] ?? 'before') as WatchStatus;
      c[st] += 1;
    });

    return c;
  }, [getUrl, sessions, watchMap]);

  // rows
  const rows = useMemo(() => {
    const base = (sessions ?? [])
      .map((s: any) => ({ s, url: getUrl(s, resourceTab) }))
      .filter((x) => Boolean(x.url));

    let filtered = base;
    if (resourceTab === 'video') {
      filtered = base.filter(({ s }) => (watchMap[s.id] ?? 'before') === watchTab);
    }

    // ✅ 찜만 보기 ON이면 내가 찜한 것만 남김
if (onlyFavorites) {
  filtered = filtered.filter(({ s }) => favSet.has(favKey(s.id, resourceTab)));
}

    if (sortMode === 'nearest') {
      filtered = [...filtered].sort(
        (a, b) => new Date(a.s.start_at).getTime() - new Date(b.s.start_at).getTime()
      );
    } else {
           filtered = [...filtered].sort((a, b) => {
        const ka = favKey(a.s.id, resourceTab);
        const kb = favKey(b.s.id, resourceTab);
        const ca = favCountMap[ka] ?? 0;
        const cb = favCountMap[kb] ?? 0;
        if (cb !== ca) return cb - ca;
        return new Date(a.s.start_at).getTime() - new Date(b.s.start_at).getTime();
      });
    }

        return filtered.map(({ s, url }) => {
      const key = favKey(s.id, resourceTab);
      return { s, url, favCount: favCountMap[key] ?? 0 };
    });
  }, [
  favCountMap,
  getUrl,
  resourceTab,
  sessions,
  sortMode,
  watchMap,
  watchTab,
  onlyFavorites,
  favSet,        
  favKey,       
]);

  const openLink = useCallback(
    async (s: any) => {
      const url = getUrl(s, resourceTab);
      if (!url) return;

      if (resourceTab === 'video') {
        const cur = (watchMap[s.id] ?? 'before') as WatchStatus;
        if (cur === 'before') await setWatchStatus(s.id, 'watching');
        touchProgress(s.id);
      }

      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [getUrl, resourceTab, setWatchStatus, touchProgress, watchMap]
  );

  const tabTitle =
    resourceTab === 'video' ? '강의영상' : resourceTab === 'zoom' ? 'Zoom 미팅' : '자료실';

  const nowCtaText =
    resourceTab === 'video' ? '지금 시청하기' : resourceTab === 'zoom' ? '줌 바로 입장' : '자료 열기';

  return {
    isAdmin,
    isInstructor,

    resourceTab,
    setResourceTab,
    watchTab,
    setWatchTab,

    sortMode,
    setSortMode,
    sortOpen,
    setSortOpen,
    sortWrapRef,

    rows,
    videoCounts,
    continueList,
    topNow,

    favSet,
    favCountMap,
    watchMap,
    progressMap,

    openLink,
    toggleFavorite,
    setWatchStatus,
    getUrl,
    touchProgress,
    tabTitle,
    nowCtaText,
    onlyFavorites,
setOnlyFavorites,
favKey,
  };
}