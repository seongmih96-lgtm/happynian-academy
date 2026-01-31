'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Search, User, ShieldCheck, Clock, Ban, CheckCircle2, XCircle } from 'lucide-react';

type ProfileRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | null;
  referrer: string | null;
  created_at?: string | null;
};

const UI = {
  card: 'bg-white rounded-2xl border border-neutral-100 p-4',
  title: 'text-sm font-semibold text-neutral-900',
  sub: 'text-xs text-neutral-500 mt-1',
  inputWrap: 'mt-3 flex items-center gap-2',
  input:
    'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400',
  btn:
    'shrink-0 rounded-xl bg-neutral-900 text-white px-3 py-2 text-sm hover:opacity-90 disabled:opacity-50',
  row: 'rounded-2xl border border-neutral-100 p-3 bg-white',
  badgeBase: 'inline-flex items-center gap-1 text-[11px] px-2 py-[2px] rounded-full border',
};

function RoleBadge({ role }: { role?: string | null }) {
  const r = (role ?? 'student').toLowerCase();
  const isAdmin = r === 'admin' || r === 'instructor';
  return (
    <span
      className={cn(
        UI.badgeBase,
        isAdmin
          ? 'bg-purple-50 text-purple-700 border-purple-100'
          : 'bg-neutral-100 text-neutral-700 border-neutral-200'
      )}
    >
      {isAdmin ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
      {isAdmin ? '관리자/강사' : '수강생'}
    </span>
  );
}

function StatusBadge({ status }: { status?: ProfileRow['status'] }) {
  const s = status ?? 'pending';
  if (s === 'approved') {
    return (
      <span className={cn(UI.badgeBase, 'bg-emerald-50 text-emerald-700 border-emerald-100')}>
        <CheckCircle2 className="w-3 h-3" /> 승인됨
      </span>
    );
  }
  if (s === 'pending') {
    return (
      <span className={cn(UI.badgeBase, 'bg-amber-50 text-amber-700 border-amber-100')}>
        <Clock className="w-3 h-3" /> 승인대기
      </span>
    );
  }
  if (s === 'rejected') {
    return (
      <span className={cn(UI.badgeBase, 'bg-rose-50 text-rose-700 border-rose-100')}>
        <XCircle className="w-3 h-3" /> 거절됨
      </span>
    );
  }
  return (
    <span className={cn(UI.badgeBase, 'bg-neutral-100 text-neutral-700 border-neutral-200')}>
      <Ban className="w-3 h-3" /> 정지됨
    </span>
  );
}

export default function AdminUserSearchSection() {
  const [meRole, setMeRole] = useState<string>('student');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProfileRow[]>([]);

  // ✅ 관리자만 보이게: 내 role 확인
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (!uid) return;

      const { data: me } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', uid)
        .maybeSingle();

      setMeRole(String(me?.role ?? 'student'));
    })();
  }, []);

  const isAdmin = useMemo(() => {
    const r = (meRole ?? '').toLowerCase();
    return r === 'admin' || r === 'instructor';
  }, [meRole]);

  const runSearch = async () => {
  const q = query.trim();
  if (!q) {
    setResults([]);
    return;
  }

  try {
    setLoading(true);

    // ✅ 이름/이메일/전화번호만 검색 (UID/추천인 제거)
    // Supabase OR 문법: "col.operator.value, col.operator.value"
    const or = [
      `name.ilike.%${q}%`,
      `email.ilike.%${q}%`,
      `phone.ilike.%${q}%`,
    ].join(',');

    const { data, error } = await supabase
      .from('profiles')
      .select('user_id,name,email,phone,role,status,created_at')
      .or(or)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    setResults((data ?? []) as ProfileRow[]);
  } catch (e: any) {
    // ✅ alert에 uuid 에러 뜨던거 여기로 잡힘
    alert(e?.message ?? '식구 검색 실패');
  } finally {
    setLoading(false);
  }
};

  if (!isAdmin) return null;

  return (
    <section className={UI.card}>
      <div className={UI.title}>유저 검색</div>
      <div className={UI.sub}>이름/이메일/전화번호로 검색할 수 있어요.</div>

      <div className={UI.inputWrap}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예) 김해피 / kimhappy@gmail.com / 010-1234-5678"
          className={UI.input}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch();
          }}
        />
        <button type="button" onClick={runSearch} disabled={loading} className={UI.btn}>
          <Search className="w-4 h-4 inline mr-1" />
          검색
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {results.length === 0 ? (
          <div className="text-xs text-neutral-400 py-3">
            검색어를 입력하고 Enter 또는 검색 버튼을 눌러주세요.
          </div>
        ) : (
          results.map((u) => (
            <div key={u.user_id} className={UI.row}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">
                    {u.name ?? '(이름 없음)'}
                  </div>
                  <div className="mt-1 text-xs text-neutral-600 break-all">
                    {u.email ?? '이메일 없음'} {u.phone ? `· ${u.phone}` : ''}
                  </div>
                  {u.referrer && (
                    <div className="mt-1 text-xs text-neutral-500">
                      추천인: <span className="font-medium text-neutral-700">{u.referrer}</span>
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-neutral-400 break-all">UID: {u.user_id}</div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <RoleBadge role={u.role} />
                  <StatusBadge status={u.status} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}