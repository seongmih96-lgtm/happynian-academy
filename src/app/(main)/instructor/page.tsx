import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import InstructorClient from './InstructorClient';
import type { Session, Profile } from '@/types';

export const dynamic = 'force-dynamic';

export default async function InstructorPage() {
  const supabase = await createClient();

  // 1) 로그인 유저
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  // 2) 내 프로필 role 가져오기 (user_id 우선 → id fallback)
  let profile: any = null;
  let profileErrMsg: string | null = null;

  {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    profile = data ?? null;
    profileErrMsg = error?.message ?? null;
  }

  if (!profile) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    profile = data ?? null;
    profileErrMsg = profileErrMsg ?? error?.message ?? null;
  }

  const role = String(profile?.role ?? '').trim().toLowerCase();
  const isAdmin = role === 'admin';

  // 3) "강사 계정" 판별: (admin) OR (session_instructors에 배정된 적 있음)
  let isInstructor = false;
  if (!isAdmin) {
    const { data: si, error: siErr } = await supabase
      .from('session_instructors')
      .select('id')
      .eq('instructor_user_id', user.id)
      .limit(1);

    if (siErr) {
      // 강사판별 쿼리 에러는 로그만 찍고, 아래에서 권한 컷되게 둠
      console.error('[instructor] session_instructors check error:', siErr);
    }
    isInstructor = (si?.length ?? 0) > 0;
  }

  // 4) 권한 컷: admin도 아니고 강사도 아니면 컷
  if (!isAdmin && !isInstructor) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-neutral-200 rounded-2xl p-6 text-center">
          <div className="text-sm font-semibold text-neutral-900">접근 권한이 없어요</div>
          <div className="text-xs text-neutral-500 mt-2">
            강사 전용 페이지는 <span className="font-semibold">강사로 배정된 계정</span>만 이용할 수 있어요.
          </div>

          {/* 디버그(원인 확인용) */}
          <div className="text-[11px] text-neutral-400 mt-3">
            role: {String(role || 'null')} / isInstructor: {String(isInstructor)} / profile:{' '}
            {profile ? 'loaded' : 'null'} / err: {String(profileErrMsg ?? 'none')}
          </div>
        </div>
      </div>
    );
  }

  // 5) 세션 로드
  // ✅ 절대 sessions.instructor 컬럼 조회/필터 금지
  let sessions: any[] = [];

  if (isAdmin) {
    // admin은 전체 세션(원하면 여기서 기간 필터 추가 가능)
    const { data, error } = await supabase
      .from('sessions')
      .select(
        'id,title,start_at,end_at,region,level,session_no,classroom_url,zoom_url,materials_url,materials,notes'
      )
      .order('start_at', { ascending: true });

    if (error) {
      return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-neutral-200 rounded-2xl p-6">
            <div className="text-sm font-semibold text-neutral-900">세션을 불러오지 못했어요</div>
            <div className="text-xs text-neutral-500 mt-2">{error.message}</div>
          </div>
        </div>
      );
    }

    sessions = (data ?? []) as Session[];
  } else {
    // 강사는 v_my_sessions 기반으로 "내 세션"만
    const { data: mySess, error: mySessErr } = await supabase
      .from('v_my_sessions')
      .select('session_id');

    if (mySessErr) {
      return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-neutral-200 rounded-2xl p-6">
            <div className="text-sm font-semibold text-neutral-900">세션을 불러오지 못했어요</div>
            <div className="text-xs text-neutral-500 mt-2">{mySessErr.message}</div>
          </div>
        </div>
      );
    }

    const ids = (mySess ?? []).map((r: any) => r.session_id).filter(Boolean);

    if (ids.length) {
      const { data: sData, error: sErr } = await supabase
        .from('sessions')
        .select(
          'id,title,start_at,end_at,region,level,session_no,classroom_url,zoom_url,materials_url,materials,notes'
        )
        .in('id', ids)
        .order('start_at', { ascending: true });

      if (sErr) {
        return (
          <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white border border-neutral-200 rounded-2xl p-6">
              <div className="text-sm font-semibold text-neutral-900">세션을 불러오지 못했어요</div>
              <div className="text-xs text-neutral-500 mt-2">{sErr.message}</div>
            </div>
          </div>
        );
      }

      sessions = (sData ?? []) as Session[];
    }
  }

  return (
    <InstructorClient
      profile={(profile as Profile) ?? null}
      sessions={(sessions as Session[]) ?? []}
    />
  );
}