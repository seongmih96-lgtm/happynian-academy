export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NotificationsContent from './NotificationsContent';

export default async function NotificationsPage() {
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

  // 3) 알림받기 목록(레벨 단위): notify_enabled=true만
  const { data: favoritesRaw, error: favError } = await supabase
    .from('favorites')
    .select('id, user_id, region, level, is_favorite, notify_enabled, created_at')
    .eq('user_id', user.id)
    .eq('notify_enabled', true);

  if (favError) {
    return <div className="p-4">알림 목록 불러오기 실패: {favError.message}</div>;
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
    console.log('[notifications/page] allLevelErr', allLevelErr);
    console.log('[notifications/page] activeLevelKeys', activeLevelKeys.length);
    console.log('[notifications/page] favoritesRaw', favoritesRaw?.length);
    console.log('[notifications/page] favoritesFiltered', favorites.length);
    console.log('[notifications/page] hiddenCount', hiddenCount);
  }

  return (
    <NotificationsContent
      profile={profile}
      favorites={favorites}
      sessions={sessions}
      activeLevelKeys={activeLevelKeys}
      hiddenCount={hiddenCount}
    />
  );
}