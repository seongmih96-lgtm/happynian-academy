// app/sessions/[id]/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SessionDetailClient from './SessionDetailClient';

type PeriodInstructor = {
  user_id: string;
  name?: string | null;
  role?: string | null;
  sort_order?: number | null;
};

type PeriodOut = {
  id: string | null;
  period_no: 1 | 2 | 3;
  title?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  instructors: PeriodInstructor[];
};

export default async function SessionDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // ✅ 세션 + 교시 + 교시별 강사 조인
  const { data: sessionRaw, error } = await supabase
    .from('sessions')
    .select(
      `
      *,
      session_periods (
        id,
        period_no,
        title,
        start_at,
        end_at,
        session_instructors (
          role,
          sort_order,
          profiles:instructor_user_id ( user_id, name )
        )
      )
    `
    )
    .eq('id', params.id)
    .single();

  if (error || !sessionRaw) {
    return <div className="p-4">세션을 찾을 수 없어요.</div>;
  }

  // ✅ 1~3교시 기본 틀 (DB에 없어도 UI는 고정)
  const base: Record<1 | 2 | 3, PeriodOut> = {
    1: { id: null, period_no: 1, title: null, start_at: null, end_at: null, instructors: [] },
    2: { id: null, period_no: 2, title: null, start_at: null, end_at: null, instructors: [] },
    3: { id: null, period_no: 3, title: null, start_at: null, end_at: null, instructors: [] },
  };

  const periodRows = ((sessionRaw as any).session_periods ?? []) as any[];

  // ✅ DB 값으로 base 덮어쓰기
  for (const p of periodRows) {
    const no = Number(p?.period_no) as 1 | 2 | 3;
    if (!(no === 1 || no === 2 || no === 3)) continue;

    const instructors: PeriodInstructor[] = ((p?.session_instructors ?? []) as any[])
      .map((r: any) => ({
        user_id: String(r?.profiles?.user_id ?? '').trim(),
        name: r?.profiles?.name ?? null,
        role: r?.role ?? null,
        sort_order: r?.sort_order ?? null,
      }))
      .filter((x) => x.user_id);

    // ✅ 교시 내부 강사 정렬
    instructors.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));

    base[no] = {
      id: p?.id ?? null,
      period_no: no,
      title: p?.title ?? null,
      start_at: p?.start_at ?? null,
      end_at: p?.end_at ?? null,
      instructors,
    };
  }

  // ✅ 최종 periods는 배열로 내려줌 (Client가 배열 전제)
  const periods: PeriodOut[] = [base[1], base[2], base[3]];

  // ✅ sessionRaw에서 session_periods는 제거(깔끔하게)
  const { session_periods, ...rest } = sessionRaw as any;

  const session = {
    ...rest,
    periods,
  };

  return <SessionDetailClient session={session as any} />;
}