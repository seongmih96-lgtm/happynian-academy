import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminContent } from './AdminContent';
import type { Profile, Session, Payment, WebhookLog } from '@/types';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // 관리자 확인
const { data: me } = await supabase
  .from('profiles')
  .select('user_role')
  .eq('user_id', user.id)
  .single()

if (me?.user_role !== 'admin') {
  redirect('/home')
}

  // 승인 대기 사용자
  const { data: pendingUsers } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  // 최근 가입 사용자
  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('*')
    .neq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);

  // 최근 세션
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('*')
    .order('start_at', { ascending: true })
    .limit(20);

  // 미납 현황
  const { data: unpaidPayments } = await supabase
    .from('payments')
    .select(`
      *,
      profile:profiles(name, email, region, level)
    `)
    .eq('paid', false)
    .order('month', { ascending: false })
    .limit(50);

  // 웹훅 로그
  const { data: webhookLogs } = await supabase
    .from('webhook_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <AdminContent
      pendingUsers={(pendingUsers as Profile[]) || []}
      recentUsers={(recentUsers as Profile[]) || []}
      recentSessions={(recentSessions as Session[]) || []}
      unpaidPayments={unpaidPayments || []}
      webhookLogs={(webhookLogs as WebhookLog[]) || []}
    />
  );
}
