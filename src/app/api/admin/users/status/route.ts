import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs'; // ✅ 혹시 edge로 잡히는 것 방지

function supabaseFromCookies() {
  const cookieStore = cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error('ENV missing: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {}
      },
    },
  });
}

function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('ENV missing: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceKey);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user_id = String(body?.user_id ?? '').trim();
    const status = String(body?.status ?? '').trim(); // approved | rejected

    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }

    // 1) 요청자 로그인 확인
    const supabase = supabaseFromCookies();
    const {
      data: { user },
      error: uErr,
    } = await supabase.auth.getUser();

    if (uErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    // 2) 요청자가 admin인지 확인
    const { data: me, error: meErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (meErr) return NextResponse.json({ error: meErr.message }, { status: 500 });
    if (me?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    // 3) service role로 업데이트
    const admin = supabaseService();
    const { error: upErr } = await admin.from('profiles').update({ status }).eq('user_id', user_id);

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown' }, { status: 500 });
  }
}