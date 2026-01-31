import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// ✅ 관리자 세션 확인용(쿠키 기반)
function supabaseFromCookies() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // ✅ 수정: cookiesToSet 타입 명시
        setAll(
  cookiesToSet: {
    name: string;
    value: string;
    options?: any;
  }[]
) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // cookieStore.set이 타입상 막힐 수 있어 any로 한 번 풀어줌(런타임은 정상)
              (cookieStore as any).set(name, value, options);
            });
          } catch {}
        },
      },
    }
  );
}

// ✅ 실제 업데이트는 service role로 (RLS 우회)
// .env.local에 SUPABASE_SERVICE_ROLE_KEY 있어야 함 (NEXT_PUBLIC 아님!)
function supabaseService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    // 1) 요청자(관리자)인지 확인
    const supabase = supabaseFromCookies();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { data: me } = await supabase
      .from('profiles')
      .select('user_role')
      .eq('user_id', user.id)
      .single();

    if (me?.user_role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // 2) 승인 처리(approved로 변경)
    const admin = supabaseService();
    const { error } = await admin
      .from('profiles')
      .update({ status: 'approved' })
      .eq('user_id', user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'unknown' },
      { status: 500 }
    );
  }
}