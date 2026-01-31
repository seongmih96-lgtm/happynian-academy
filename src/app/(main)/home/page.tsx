export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import HomeContent from './HomeContent';

function startOfWeekMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default async function HomePage() {
  const supabase = await createClient();

  // 1) 로그인 체크
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 2) 내 프로필
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) redirect('/pending');
  if (profile.role !== 'admin' && profile.status !== 'approved') redirect('/pending');

  // 3) 이번주 범위 (KST 기준)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const weekStart = startOfWeekMonday(now);
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  // 4) sessions (이번주)
  const { data: sessionsRaw, error: sessionsError } = await supabase
    .from('sessions')
    .select(`
      id, title, region, level, start_at, end_at, session_no, instructor, materials, notes,
      session_instructors (
        role,
        sort_order,
        profiles:instructor_user_id ( user_id, name )
      )
    `)
    .gte('start_at', weekStart.toISOString())
    .lt('start_at', nextWeekStart.toISOString())
    .order('start_at', { ascending: true });

  const sessions =
    (sessionsRaw ?? []).map((s: any) => {
      const instructors =
        (s.session_instructors ?? []).map((r: any) => ({
          user_id: String(r.profiles?.user_id ?? ''),
          name: r.profiles?.name ?? null,
          role: r.role ?? null,
          sort_order: r.sort_order ?? null,
        })) ?? [];

      return { ...s, instructors };
    }) ?? [];

    // ✅ activeLevelKeys 만들기 (region|level 조합)
const activeLevelKeys = Array.from(
  new Set(
    (sessions ?? [])
      .map((s: any) => `${String(s?.region ?? '').trim()}|${String(s?.level ?? '').trim()}`)
      .filter((k: string) => {
        const [region, level] = k.split('|');
        return Boolean(region) && Boolean(level);
      })
  )
);

  // ✅ (핵심) 전체기간 sessions에서 "유효 레벨키" 가져오기
  const { data: allSessions, error: allSessionsErr } = await supabase
    .from('sessions')
    .select('region, level');

  const activeLevelKeySet = new Set<string>();
  (allSessions ?? []).forEach((s: any) => {
    const r = String(s?.region ?? '').trim();
    const l = String(s?.level ?? '').trim();
    if (r && l) activeLevelKeySet.add(`${r}|${l}`);
  });

  // 5) favorites (전체)
  const { data: favoritesRaw, error: favError } = await supabase
    .from('favorites')
    .select('id, user_id, region, level, is_favorite, notify_enabled, notify_rules, created_at')
    .eq('user_id', user.id);

  const favorites = favoritesRaw ?? [];

  // ✅ (핵심) 삭제된 강의(레벨키) 자동 제외된 favorites만 HomeContent로 내려주기
  const filteredFavorites = favorites.filter((f: any) =>
    activeLevelKeySet.has(`${String(f?.region ?? '').trim()}|${String(f?.level ?? '').trim()}`)
  );

  // 디버그 (개발용)
  if (process.env.NODE_ENV === 'development') {
    console.log('[sessionsError]', sessionsError);
    console.log('[favError]', favError);
    console.log('[allSessionsErr]', allSessionsErr);
    console.log('[favoritesRaw length]', favorites?.length);
    console.log('[filteredFavorites length]', filteredFavorites?.length);
  }

  return (
    <HomeContent
      sessions={sessions}
      profile={profile}
      favorites={filteredFavorites}
      activeLevelKeys={activeLevelKeys}
    />
  );
}