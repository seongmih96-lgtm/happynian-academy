import { createClient } from '@/lib/supabase/server';
import ClassroomClient from './ClassroomClient';
import type { Session, Profile } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ClassroomPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ✅ 프로필
  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id) // ✅ 너희 구조
      .maybeSingle();

    profile = (data as any) ?? null;
  }

  // ✅ 세션
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .order('start_at', { ascending: true });

  return (
    <ClassroomClient
      profile={profile}
      sessions={(sessions as Session[]) ?? []}
    />
  );
}