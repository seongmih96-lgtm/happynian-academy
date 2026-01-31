'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Session, Profile } from '@/types';
import { cn, formatKoreanDate, formatTimeRange } from '@/lib/utils';
import { Heart, ExternalLink, Video, Play, Folder } from 'lucide-react';

type Kind = 'video' | 'zoom' | 'materials';

export default function ProfileFavoritesClient({
  profile,
  sessions,
}: {
  profile: Profile | null;
  sessions: Session[];
}) {
  const [userId, setUserId] = useState<string | null>(null);

  const [kind, setKind] = useState<Kind>('video');
  const [favSet, setFavSet] = useState<Set<string>>(new Set());
  const [favCountMap, setFavCountMap] = useState<Record<string, number>>({});

  const sessionMap = useMemo(() => {
    const m = new Map<string, any>();
    (sessions ?? []).forEach((s: any) => m.set(s.id, s));
    return m;
  }, [sessions]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;

      const sessionIds = (sessions ?? []).map((s) => s.id);

      // 내 찜 (public.resource_favorites)
const { data: favs } = await supabase
  .from('resource_favorites')
  .select('scope,item_id,kind')
  .eq('user_id', uid)
  .eq('scope', 'session')
  .in('item_id', sessionIds);

const s = new Set<string>();
(favs ?? []).forEach((f: any) => s.add(`${f.item_id}|${f.kind}`));
setFavSet(s);

      // 찜 카운트(표시용) - public.resource_favorite_counts
const { data: counts } = await supabase
  .from('resource_favorite_counts')
  .select('scope,item_id,kind,cnt,updated_at')
  .eq('scope', 'session')
  .in('item_id', sessionIds);

const m: Record<string, number> = {};
(counts ?? []).forEach((c: any) => {
  m[`${c.item_id}|${c.kind}`] = c.cnt ?? 0;
});
setFavCountMap(m);
    })();
  }, [sessions, supabase]);

  const getUrl = (s: any, k: Kind) => {
    if (k === 'video') return s?.classroom_url ?? '';
    if (k === 'zoom') return s?.zoom_url ?? '';
    return s?.materials_url ?? '';
  };

  const list = useMemo(() => {
    const out: any[] = [];
    for (const key of favSet) {
      const [sid, k] = key.split('|') as [string, Kind];
      if (k !== kind) continue;
      const s = sessionMap.get(sid);
      if (!s) continue;
      const url = getUrl(s, k);
      if (!url) continue;
      out.push({
        s,
        kind: k,
        url,
        favCount: favCountMap[`${sid}|${k}`] ?? 0,
      });
    }

    // ✅ 추천순 = 찜 많은순 (내가 이미 찜한 것들만 모은 페이지라서)
    out.sort((a, b) => {
      if (b.favCount !== a.favCount) return b.favCount - a.favCount;
      return new Date(a.s.start_at).getTime() - new Date(b.s.start_at).getTime();
    });

    return out;
  }, [favSet, kind, favCountMap, sessionMap]);

  const unfav = async (sid: string, k: Kind) => {
    if (!userId) return;
    const kk = `${sid}|${k}`;
    setFavSet((prev) => {
      const next = new Set(prev);
      next.delete(kk);
      return next;
    });
    await supabase
  .from('resource_favorites')
  .delete()
  .eq('user_id', userId)
  .eq('scope', 'session')
  .eq('item_id', sid)
  .eq('kind', k);
  };

  const open = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        <div className="text-sm font-semibold text-neutral-900">내가 찜한 콘텐츠</div>
        <div className="text-xs text-neutral-500 mt-1">
          마음이 간 곳은, 다시 보면 실력이 돼요 💛
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <KindTab active={kind === 'video'} onClick={() => setKind('video')} icon={<Video className="w-4 h-4" />} label="강의영상" />
          <KindTab active={kind === 'zoom'} onClick={() => setKind('zoom')} icon={<Play className="w-4 h-4" />} label="Zoom" />
          <KindTab active={kind === 'materials'} onClick={() => setKind('materials')} icon={<Folder className="w-4 h-4" />} label="자료" />
        </div>

        <div className="mt-4 space-y-2">
          {list.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-100 p-10 text-center text-sm text-neutral-500">
              아직 찜한 {kind === 'video' ? '강의영상' : kind === 'zoom' ? 'Zoom' : '자료'}가 없어요.
              <div className="text-xs mt-2 text-neutral-400">
                강의실에서 ❤️ 눌러두면 여기로 모여요
              </div>
            </div>
          ) : (
            list.map(({ s, url, favCount }) => (
              <div key={s.id} className="bg-white rounded-2xl border border-neutral-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 truncate">{s.title}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {formatKoreanDate(s.start_at, 'M월 d일 (E)')} · {formatTimeRange(s.start_at, s.end_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => unfav(s.id, kind)}
                      className="px-3 py-2 rounded-xl border border-rose-100 bg-rose-50 text-rose-700 text-sm flex items-center gap-2"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                      <span className="text-xs">{favCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => open(url)}
                      className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm flex items-center gap-2 hover:opacity-90"
                    >
                      <ExternalLink className="w-4 h-4" />
                      열기
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function KindTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border px-3 py-2 text-sm flex items-center justify-center gap-2',
        active
          ? 'bg-neutral-900 text-white border-neutral-900'
          : 'bg-white text-neutral-900 border-neutral-200 hover:bg-neutral-50'
      )}
    >
      {icon}
      {label}
    </button>
  );
}