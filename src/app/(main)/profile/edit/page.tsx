import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProfileEditClient from './ProfileEditClient';

export default async function ProfileEditPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id,name,email,phone,avatar_url,role,status,referrer')
    .eq('user_id', user.id)
    .single();

  return <ProfileEditClient profile={profile} />;
}