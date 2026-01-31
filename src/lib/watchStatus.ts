import { supabase } from '@/lib/supabase/client';

export type WatchStatus = 'before' | 'watching' | 'done';
export type WatchKind = 'video';

export async function upsertWatchStatus(
  userId: string,
  sessionId: string,
  kind: WatchKind,
  status: WatchStatus
) {
  return supabase
    .from('resource_watch_status')
    .upsert(
      {
        user_id: userId,
        session_id: sessionId,
        kind,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,session_id,kind' }
    );
}

export async function fetchWatchStatusMap(
  userId: string,
  sessionIds: string[],
  kind: WatchKind
): Promise<Record<string, WatchStatus>> {
  if (sessionIds.length === 0) return {};

  const { data } = await supabase
    .from('resource_watch_status')
    .select('session_id,status')
    .eq('user_id', userId)
    .eq('kind', kind)
    .in('session_id', sessionIds);

  const map: Record<string, WatchStatus> = {};
  (data ?? []).forEach((r: any) => {
    map[r.session_id] = r.status;
  });

  return map;
}