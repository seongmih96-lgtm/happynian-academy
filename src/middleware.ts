import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers'

type CookieToSet = {
  name: string;
  value: string;
  options?: any;
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  // ✅ 누구나 접근 허용 경로
  const allowPrefixes = ['/login', '/signup', '/pending', '/api', '/signout'];
  const isAllowed =
    allowPrefixes.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico';

  if (isAllowed) return response;

  // 1) 로그인 체크
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 2) status/role 체크 (profiles 컬럼명: status, role)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('status, role')
    .eq('user_id', user.id)
    .maybeSingle();

  // 프로필이 없거나 에러면 → 안전하게 pending으로
  if (!profile || profileError) {
    const url = request.nextUrl.clone();
    url.pathname = '/pending';
    return NextResponse.redirect(url);
  }

  const role = String(profile.role ?? '').trim().toLowerCase();
  const status = String(profile.status ?? '').trim().toLowerCase();

  // ✅ admin은 pending 예외 + pending이면 /admin으로
  if (role === 'admin') {
    if (pathname.startsWith('/pending')) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }
    return response;
  }

  // ✅ 일반 유저: approved 아니면 pending으로
  if (status !== 'approved') {
    if (pathname.startsWith('/pending')) return response;
    const url = request.nextUrl.clone();
    url.pathname = '/pending';
    return NextResponse.redirect(url);
  }

  // ✅ approved 유저가 pending에 있으면 home으로
  if (pathname.startsWith('/pending')) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};