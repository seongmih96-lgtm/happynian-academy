import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AlertsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: watchlist } = await supabase
    .from('resource_watch_status')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="sticky top-0 z-10 bg-neutral-50/90 backdrop-blur border-b border-neutral-100">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <div className="text-sm font-semibold text-neutral-900">알림받기 모아보기</div>
          <div className="text-xs text-neutral-500 mt-0.5">내가 알림 켜둔 항목들을 한눈에 봐요 🔔</div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 py-4 space-y-3">
        {(watchlist ?? []).length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-sm text-neutral-600">
            아직 알림받기 등록된 항목이 없어요.
          </div>
        ) : (
          (watchlist ?? []).map((w: any) => (
            <div key={w.id} className="bg-white border border-neutral-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-900">
                  {w.session_id ? `세션 알림 (${w.session_id})` : w.resource_id ? `콘텐츠 알림 (${w.resource_id})` : '알림 항목'}
                </div>
                <div className="text-xs px-2 py-1 rounded-full border">
                  {w.enabled === false ? 'OFF' : 'ON'}
                </div>
              </div>
              <div className="text-xs text-neutral-500 mt-2">등록일: {String(w.created_at ?? '').slice(0, 10)}</div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}