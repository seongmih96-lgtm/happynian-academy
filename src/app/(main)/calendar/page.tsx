import { createClient } from '@/lib/supabase/server';
import { startOfMonth, endOfMonth, addMonths, format } from 'date-fns';
import { CalendarContent } from './CalendarContent';
import type { Session, Favorite } from '@/types';

export default async function CalendarPage() {
  const supabase = await createClient();

  // 현재 사용자
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let favorites: Favorite[] = [];
  if (user) {
    const { data: favoritesData } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', user.id);

    favorites = favoritesData || [];
  }

  // 이번 달 + 다음 달 세션 조회
  const today = new Date();
  const monthStart = startOfMonth(today);
  const nextMonthEnd = endOfMonth(addMonths(today, 1));

  // ✅ 핵심: sessions + session_instructors + profiles(name) 같이 가져오기
  const { data: sessionsRaw, error } = await supabase
    .from('sessions')
    .select(
      `
      *,
      session_instructors (
        role,
        sort_order,
        instructor_user_id,
        profiles:profiles (
          user_id,
          name
        )
      )
    `
    )
    .gte('start_at', format(monthStart, 'yyyy-MM-dd'))
    .lte('start_at', format(nextMonthEnd, 'yyyy-MM-dd'))
    .order('start_at', { ascending: true });

  if (error) {
    // 필요하면 로그 확인용
    // console.error('Calendar sessions fetch error:', error);
  }

  // ✅ SessionCard/CalendarContent가 기대하는 형태로 매핑: session.instructors 만들기
  const sessions = (sessionsRaw ?? []).map((s: any) => {
    const instructors =
      (s.session_instructors ?? [])
        .map((r: any) => ({
          user_id: String(r?.instructor_user_id ?? r?.profiles?.user_id ?? ''),
          name: r?.profiles?.name ?? null,
          role: r?.role ?? null,
          sort_order: r?.sort_order ?? null,
        }))
        .filter((x: any) => String(x.name ?? '').trim() !== '') || [];

    // session_instructors 필드는 굳이 프론트로 안 내려도 되지만,
    // 혹시 디버깅/추후 확장 위해 남겨도 상관 없음.
    return {
      ...s,
      instructors,
    };
  }) as Session[];

  return <CalendarContent sessions={sessions} favorites={favorites} />;
}