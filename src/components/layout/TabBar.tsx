'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Home, Calendar, CheckSquare, PlayCircle, User, GraduationCap, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Role = 'admin' | 'student' | null;
const LS_ROLE_KEY = 'happinion_role_v1';

/**
 * ✅ next/navigation(usePathname) 없이도 안전하게 pathname 추적
 * - history.pushState/replaceState "덮어쓰기" 금지 (전역 오염/에러바운더리 꼬임 방지)
 * - 대신:
 *   1) popstate (뒤로/앞으로)
 *   2) document click capture (Next <Link> 포함 이동 직후 tick에서 location 읽기)
 */
function useClientPathname() {
  const [pathname, setPathname] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sync = () => setPathname(window.location.pathname);

    // 초기
    sync();

    // 뒤로/앞으로
    window.addEventListener('popstate', sync);

    // Link 클릭 이동 감지 (Next Link 포함)
    const onClickCapture = (e: MouseEvent) => {
      // 새탭/수정키 클릭은 무시
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // a 태그 클릭인지 확인
      const target = e.target as HTMLElement | null;
      const a = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;

      const href = a.getAttribute('href') || '';
      // 외부 링크 / 해시 / mailto 등 제외
      if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/#') || href.startsWith('#')) return;

      // Next가 라우팅 처리한 "직후"에 pathname 읽기
      setTimeout(sync, 0);
    };

    document.addEventListener('click', onClickCapture, true);

    return () => {
      window.removeEventListener('popstate', sync);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  return pathname;
}

export function TabBar() {
  const pathname = useClientPathname();
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    let alive = true;

    const applyRole = (r: Role) => {
      if (!alive) return;
      setRole(r);
      try {
        if (r === 'admin' || r === 'student') localStorage.setItem(LS_ROLE_KEY, r);
        else localStorage.removeItem(LS_ROLE_KEY);
      } catch {}
    };

    // 0) 캐시 role 먼저 적용(깜빡임 방지)
    try {
      const cached = localStorage.getItem(LS_ROLE_KEY);
      if (cached === 'admin' || cached === 'student') setRole(cached);
    } catch {}

    const loadRole = async () => {
      const { data, error: authErr } = await supabase.auth.getUser();
      if (authErr) console.error('[TabBar] auth.getUser error:', authErr);

      const uid = data?.user?.id;
      if (!uid) {
        applyRole(null);
        return;
      }

      const { data: p, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', uid)
        .maybeSingle();

      if (error) {
        console.error('[TabBar] profiles role load error:', error);
        applyRole(null);
        return;
      }

      const r = (p as any)?.role;
      if (r === 'admin' || r === 'student') applyRole(r);
      else applyRole(null);
    };

    loadRole();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      try {
        localStorage.removeItem(LS_ROLE_KEY);
      } catch {}
      applyRole(null);
      loadRole();
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const items = useMemo(() => {
    if (!role) {
      return [
        { href: '/home', label: '홈', icon: Home },
        { href: '/calendar', label: '캘린더', icon: Calendar },
        { href: '/classroom', label: '강의실', icon: PlayCircle },
        { href: '/profile', label: '프로필', icon: User },
      ];
    }

    if (role === 'student') {
      return [
        { href: '/home', label: '홈', icon: Home },
        { href: '/calendar', label: '캘린더', icon: Calendar },
        { href: '/attendance', label: '출석', icon: CheckSquare },
        { href: '/classroom', label: '강의실', icon: PlayCircle },
        { href: '/profile', label: '프로필', icon: User },
      ];
    }

    return [
      { href: '/home', label: '홈', icon: Home },
      { href: '/calendar', label: '캘린더', icon: Calendar },
      { href: '/classroom', label: '강의실', icon: PlayCircle },
      { href: '/instructor', label: '강사전용', icon: GraduationCap },
      { href: '/my-lectures', label: '내 강의', icon: ClipboardList },
      { href: '/profile', label: '프로필', icon: User },
    ];
  }, [role]);

  const colsClass = items.length === 6 ? 'grid-cols-6' : items.length === 5 ? 'grid-cols-5' : 'grid-cols-4';

  const isActive = (current: string, href: string) => {
    if (!current) return false;
    if (current === href) return true;
    if (href !== '/' && current.startsWith(href + '/')) return true;
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50">
      <div className={cn('mx-auto max-w-3xl grid', colsClass)}>
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          const Icon = it.icon;

          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'flex flex-col items-center justify-center py-2 text-xs transition',
                active ? 'text-neutral-900 font-semibold' : 'text-neutral-400 hover:text-neutral-600'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="mt-1">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}