import { createClient } from '@/lib/supabase/server';
import MyLecturesClient from './MyLecturesClient';

export default async function MyLecturesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-sm text-neutral-700">
          로그인 후 이용할 수 있어요.
        </div>
      </div>
    );
  }

  // profiles에서 현재 유저 프로필 가져오기
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('user_id,name,role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (pErr || !profile) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-sm text-neutral-700">
          프로필 정보를 불러올 수 없어요. (관리자에게 문의)
        </div>
      </div>
    );
  }

  return <MyLecturesClient profile={profile} />;
}