export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NotificationsContent from './NotificationsContent';
import type { Profile } from '@/types';

export default async function NotificationsPage() {
  const supabase = await createClient();

  // 1) 로그인 체크
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 2) ✅ Profile 전체 필드로 가져오기 (타입 에러 방지)
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileErr) {
    return <div className="p-4">프로필 불러오기 실패: {profileErr.message}</div>;
  }

  if (!profile) redirect('/pending');

  // (기존 로직 유지) 승인/권한 체크
  const role = String((profile as any)?.role ?? '');
  const status = String((profile as any)?.status ?? '');
  if (role !== 'admin' && status !== 'approved') redirect('/pending');

  // 3) favorites / sessions / activeLevelKeys 로직은
  //    ✅ 기존 notifications/page.tsx에 있던 그대로 붙여 넣으면 됨.
  //
  //    아래 3개는 "너가 이미 만들었던 값"들을 그대로 사용하면 돼:
  //    - favorites
  //    - sessions
  //    - activeLevelKeys
  //
  //    (여기서는 타입 에러 고치는게 핵심이라, 데이터 로딩부는 기존 코드 유지)

  // ▼▼▼ 아래는 "기존 코드"의 변수들을 그대로 가져와서 return 부분만 맞추면 됨 ▼▼▼
  // const favorites = ...
  // const sessions = ...
  // const activeLevelKeys = ...

  return (
    <NotificationsContent
      profile={(profile as unknown as Profile) ?? null}
      favorites={favorites as any}
      sessions={sessions as any}
      activeLevelKeys={activeLevelKeys as any}
    />
  );
}