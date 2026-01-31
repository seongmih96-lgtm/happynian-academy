import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const region = body?.region;
    const level = body?.level;
    if (!region || !level) {
      return NextResponse.json({ ok: false, error: 'Missing region/level' }, { status: 400 });
    }

    // 1) 기존 row 조회
    const { data: existing, error: findErr } = await supabase
      .from('favorites')
      .select('id, is_favorite, notify_enabled, user_id, region, level')
      .eq('user_id', user.id)
      .eq('region', region)
      .eq('level', level)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ ok: false, error: findErr.message }, { status: 500 });
    }

    // 2) 없으면 새로 생성 (⭐만 true, 🔔는 false)
    if (!existing) {
      const { data: created, error: insErr } = await supabase
        .from('favorites')
        .insert({
          user_id: user.id,
          region,
          level,
          is_favorite: true,
          notify_enabled: false,
        })
        .select('*')
        .single();

      if (insErr) {
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, favorite: created });
    }

    // 3) 있으면 is_favorite만 토글 (notify_enabled는 건드리지 않음)
    const nextValue = !existing.is_favorite;

    const { data: updated, error: updErr } = await supabase
      .from('favorites')
      .update({ is_favorite: nextValue })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, favorite: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}