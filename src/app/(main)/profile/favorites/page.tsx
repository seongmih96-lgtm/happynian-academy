import { createClient } from '@/lib/supabase/server';
import type { Session, Profile } from '@/types';
import ProfileFavoritesClient from './ProfileFavoritesClient';

export const dynamic = 'force-dynamic';

export default async function ProfileFavoritesPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // ✅ 프로필 조회: user_id로 (중요)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  // ✅ 찜: favorites 테이블이 정답
  const { data: favs } = await supabase
  .from('resource_favorites')
  .select('scope,item_id,kind')
  .eq('user_id', user.id);

  // ✅ "세션 찜"만 뽑아서 sessions를 그 id만 조회
  const sessionIds = (favs ?? [])
    .filter((f: any) => f.scope === 'session' && f.item_id)
    .map((f: any) => f.item_id);

  let sessions: Session[] = [];
  if (sessionIds.length > 0) {
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .in('id', sessionIds)
      .order('start_at', { ascending: true });

    sessions = (data as Session[]) ?? [];
  }

  return (
    <ProfileFavoritesClient
      profile={(profile as Profile) ?? null}
      sessions={sessions}
    />
  );
}