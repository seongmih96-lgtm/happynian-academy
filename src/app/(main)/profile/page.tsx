import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProfileContent } from './ProfileContent';
import type { Profile, Favorite, Payment, VideoProgress } from '@/types';

export const dynamic = 'force-dynamic';

type MyLectureReg = {
  id: string;
  user_id: string;
  region: string;
  level: string;
  created_at: string;
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // ✅ profile (user_id 기준)
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id,name,email,phone,role,status,referrer,avatar_url') // ✅ avatar_url 포함
    .eq('user_id', user.id)
    .single();

  // ✅ favorites (레벨 즐겨찾기/알림 설정: HOME과 동일한 소스)
  const { data: favorites } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', user.id)
    .order('month', { ascending: false })
    .limit(12);

  const { data: videoProgress } = await supabase
    .from('video_progress')
    .select('*')
    .eq('user_id', user.id);

  const { data: myLectureRegs } = await supabase
    .from('my_lecture_registrations')
    .select('*')
    .eq('user_id', user.id);

  return (
    <ProfileContent
      profile={profile as Profile}
      favorites={(favorites as Favorite[]) ?? []}
      payments={(payments as Payment[]) ?? []}
      videoProgress={(videoProgress as VideoProgress[]) ?? []}
      myLectureRegs={(myLectureRegs as MyLectureReg[]) ?? []}
    />
  );
}