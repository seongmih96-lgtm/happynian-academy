export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import FavoritesContent from './FavoritesContent';

export default async function FavoritesPage() {
  const supabase = await createClient();

  // 1) 로그인 체크
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 2) 프로필 체크(홈과 동일)
  const { data: profile } = await supabase
    .from('profiles')
    .select('status, role, region, level')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) redirect('/pending');
  if (profile.role !== 'admin' && profile.status !== 'approved') redirect('/pending');

  // ✅ A) 전체기간 기준: DB에 존재하는 강의 레벨 목록(activeLevelKeys)
  const { data: allLevelRows, error: allLevelErr } = await supabase
    .from('sessions')
    .select('region, level');

  const activeLevelKeys = Array.from(
    new Set(
      (allLevelRows ?? [])
        .map((r: any) => `${String(r?.region ?? '').trim()}|${String(r?.level ?? '').trim()}`)
        .filter((k: string) => {
          const [region, level] = k.split('|');
          return Boolean(region) && Boolean(level);
        })
    )
  );
  const activeKeySet = new Set(activeLevelKeys);

  // 3) 즐겨찾기 목록(레벨 단위) 가져오기: is_favorite=true만
  const { data: favoritesRaw, error: favError } = await supabase
    .from('favorites')
    .select('id, user_id, region, level, is_favorite, notify_enabled, created_at')
    .eq('user_id', user.id)
    .eq('is_favorite', true);

  if (favError) {
    return <div className="p-4">즐겨찾기 불러오기 실패: {favError.message}</div>;
  }

  // ✅ B) 삭제된 강의(= sessions에 없는 region|level) 자동 제외 + 숨긴 개수
  const favorites = (favoritesRaw ?? []).filter((f: any) => {
    const region = String(f?.region ?? '').trim();
    const level = String(f?.level ?? '').trim();
    if (!region || !level) return false;
    return activeKeySet.has(`${region}|${level}`);
  });

  const hiddenCount = (favoritesRaw?.length ?? 0) - favorites.length;

  // 4) 세션 전체 가져오기(일단 MVP: 전체→클라에서 필터)
  const { data: sessionsRaw, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, title, region, level, start_at, end_at, session_no, materials, notes')
    .order('start_at', { ascending: true });

  if (sessionsError) {
    return <div className="p-4">세션 불러오기 실패: {sessionsError.message}</div>;
  }

  const sessions = (sessionsRaw ?? []).map((s: any) => ({
    ...s,
    startAt: s.start_at,
    endAt: s.end_at,
  }));

  if (process.env.NODE_ENV === 'development') {
    console.log('[favorites/page] allLevelErr', allLevelErr);
    console.log('[favorites/page] activeLevelKeys', activeLevelKeys.length);
    console.log('[favorites/page] favoritesRaw', favoritesRaw?.length);
    console.log('[favorites/page] favoritesFiltered', favorites.length);
    console.log('[favorites/page] hiddenCount', hiddenCount);
  }

  return (
    <FavoritesContent
      profile={profile}
      favorites={favorites}
      sessions={sessions}
      activeLevelKeys={activeLevelKeys}
      hiddenCount={hiddenCount}
    />
  );
}