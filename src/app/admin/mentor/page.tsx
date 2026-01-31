import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import MentorAdminClient from './MentorAdminClient';

export default async function MentorAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id,role,name,email')
    .eq('user_id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') redirect('/profile');

  return <MentorAdminClient />;
}