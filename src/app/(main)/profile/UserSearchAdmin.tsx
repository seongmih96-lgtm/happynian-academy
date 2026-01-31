'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type ProfileRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | null;
  created_at?: string | null;
};

type SessionRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  region: string | null;
  level: string | null;
  session_no: number | null;
  instructor: string | null;
};

type AttendanceRow = {
  session_id: string;
  user_id: string;
  status: string | null;
  checked_at: string | null;
};

type HomeworkRow = {
  session_id: string;
  user_id: string;
  url: string | null;
  note: string | null;
  submitted_at: string | null;
  media_urls: any; // jsonb
};

type ModelWorkRow = {
  id: string;
  user_id: string;
  gender: string | null;
  title: string | null;
  comment: string | null;
  media_urls: any; // jsonb
  created_at: string | null;
};

type Props = {
  isAdmin: boolean;              // 기존 유지 (role 체크용)
  showAdminActions?: boolean;    // ✅ 추가 (기본 true)
};

const ENROLL_REG_TABLE = 'my_lecture_registrations';
const SESSIONS_TABLE = 'sessions';
const ATTEND_TABLE = 'session_attendance';
const HOMEWORK_TABLE = 'session_homework_submissions';
const MODEL_WORK_TABLE = 'model_work_posts';

function safeLower(v?: string | null) {
  return String(v ?? '').toLowerCase();
}
function isAttendedStatus(status?: string | null) {
  const s = safeLower(status);
  return s === 'present' || s === 'checked' || s === 'attended';
}

function statusLabel(status: ProfileRow['status']) {
  if (status === 'approved') return '승인됨';
  if (status === 'pending') return '승인대기';
  if (status === 'rejected') return '거절됨';
  if (status === 'suspended') return '정지';
  return '알수없음';
}

function StatusPill({ status }: { status: ProfileRow['status'] }) {
  const tone =
    status === 'approved'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : status === 'pending'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : status === 'rejected'
      ? 'bg-rose-50 text-rose-700 border-rose-100'
      : status === 'suspended'
      ? 'bg-neutral-200 text-neutral-700 border-neutral-200'
      : 'bg-neutral-100 text-neutral-600 border-neutral-200';

  return (
    <span className={cn('text-[11px] px-2 py-[2px] rounded-full border', tone)}>
      {statusLabel(status)}
    </span>
  );
}

/** ✅ 검색어 하이라이트 */
function Highlight({ text, q }: { text?: string | null; q: string }) {
  const s = String(text ?? '');
  const query = q.trim();
  if (!query) return <>{s}</>;

  const lower = s.toLowerCase();
  const ql = query.toLowerCase();
  const idx = lower.indexOf(ql);
  if (idx === -1) return <>{s}</>;

  const before = s.slice(0, idx);
  const match = s.slice(idx, idx + query.length);
  const after = s.slice(idx + query.length);

  return (
    <>
      {before}
      <mark className="rounded px-1 bg-yellow-100 text-neutral-900">{match}</mark>
      {after}
    </>
  );
}

/** ✅ jsonb(media_urls) + url 을 “이미지 URL 배열”로 정규화 */
/** ✅ jsonb(media_urls) + url 을 “이미지 URL 배열”로 정규화 (강화버전) */
function normalizeMediaUrls(row: any): string[] {
  const out: string[] = [];

  const push = (v: any) => {
    if (!v) return;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s) out.push(s);
      return;
    }
    // 객체면 url 계열 키들을 최대한 찾아 넣기
    if (typeof v === 'object') {
      const candidates = [
        v.url,
        v.publicUrl,
        v.public_url,
        v.src,
        v.href,
        v.path,         // storage path일 수도
        v.fullPath,
      ];
      candidates.forEach((c) => {
        if (typeof c === 'string' && c.trim()) out.push(c.trim());
      });
    }
  };

  const media = row?.media_urls;

  // 1) media_urls가 배열인 경우: ["url", ...] 또는 [{url:""}, ...] 등
  if (Array.isArray(media)) {
    media.forEach(push);
  }
  // 2) media_urls가 객체인 경우: { urls: [...] } 또는 {0:"",1:""} 등
  else if (media && typeof media === 'object') {
  // ✅ Supabase jsonb 배열이 {0:"url"} 형태로 오는 케이스 대응
  if (Array.isArray(media)) {
    media.forEach(push);
  }
  // { urls: [...] }
  else if (Array.isArray((media as any).urls)) {
    (media as any).urls.forEach(push);
  }
  // { 0: "...", 1: "..." } 형태
  else {
    Object.values(media).forEach(push);
  }
}
  // 3) media_urls가 문자열(JSON string)인 경우
  else if (typeof media === 'string') {
    const s = media.trim();
    if (s) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) parsed.forEach(push);
        else if (parsed && typeof parsed === 'object') {
          if (Array.isArray((parsed as any).urls)) (parsed as any).urls.forEach(push);
          else Object.values(parsed).forEach(push);
        }
      } catch {
        // 그냥 문자열 url일 수도
        push(s);
      }
    }
  }

  // 과제 테이블은 url 단일도 있음 (모델에는 없지만 안전하게 유지)
  push(row?.url);

  // 중복 제거 + 빈값 제거
  return Array.from(new Set(out)).filter(Boolean);
}

/** ✅ gender 텍스트를 male/female/unknown으로 정규화 */
function normalizeGender(g?: string | null): 'male' | 'female' | 'unknown' {
  const s = safeLower(g);

  if (s === 'm' || s === 'male' || s === 'man' || s === '남' || s === '남자') return 'male';
  if (s === 'f' || s === 'female' || s === 'woman' || s === '여' || s === '여자') return 'female';

// console.log('normalizeMediaUrls out', out, row?.media_urls);

  return 'unknown';
}

async function debugModelWorkFeed(userId: string) {
  const TABLE = 'model_work_posts';

  console.log('🧪 [MODEL FEED DEBUG] start', { userId });

  // 1) RLS/권한 체크: count만 헤더로
  const c = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  console.log('1) count(head:true)', {
    count: c.count,
    error: c.error?.message,
    code: (c.error as any)?.code,
    details: (c.error as any)?.details,
    hint: (c.error as any)?.hint,
  });

  // 2) 실제 row 3개만 읽기 (media_urls 확인)
  const rows = await supabase
    .from(TABLE)
    .select('id,user_id,media_urls,created_at,gender,title')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('2) rows(limit:3)', {
    error: rows.error?.message,
    code: (rows.error as any)?.code,
    details: (rows.error as any)?.details,
    data: rows.data,
  });

  // 3) media_urls 정규화 결과 확인
  const normalized = (rows.data ?? []).map((r: any) => ({
    id: r.id,
    media_urls_raw: r.media_urls,
    normalized_media: normalizeMediaUrls(r),
  }));

  console.log('3) normalizeMediaUrls()', normalized);

  console.log('🧪 [MODEL FEED DEBUG] end');
}

export function UserSearchAdmin({ isAdmin, showAdminActions = true }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProfileRow[]>([]);

  const [selected, setSelected] = useState<ProfileRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [viewer, setViewer] = useState<{
  open: boolean;
  image: string | null;
  title?: string;
  comment?: string | null;
  date?: string;
} | null>(null);

  const [summary, setSummary] = useState<{
    attendanceRate: number;
    homeworkRate: number;
    maleModelCount: number;
    femaleModelCount: number;
  }>({
    attendanceRate: 0,
    homeworkRate: 0,
    maleModelCount: 0,
    femaleModelCount: 0,
  });

  const [feedTab, setFeedTab] = useState<'model' | 'homework'>('model');

  const [homeworkPosts, setHomeworkPosts] = useState<
    { id: string; at: string; sessionTitle: string; media: string[] }[]
  >([]);

  const [modelPosts, setModelPosts] = useState<
    { id: string; at: string; title: string; gender: 'male' | 'female' | 'unknown'; media: string[] }[]
  >([]);

  // ✅ 상세 패널로 자동 스크롤
  const detailRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (selected) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }, [selected?.user_id]);

  const qMemo = useMemo(() => query.trim(), [query]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSelected(null);
      setHomeworkPosts([]);
      setModelPosts([]);
      setSummary({ attendanceRate: 0, homeworkRate: 0, maleModelCount: 0, femaleModelCount: 0 });
      return;
    }

    try {
      setLoading(true);
      const or = [`name.ilike.%${q}%`, `email.ilike.%${q}%`, `phone.ilike.%${q}%`].join(',');

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,name,email,phone,role,status,created_at')
        .or(or)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      setResults((data ?? []) as ProfileRow[]);
      setSelected(null);
      setHomeworkPosts([]);
      setModelPosts([]);
      setSummary({ attendanceRate: 0, homeworkRate: 0, maleModelCount: 0, femaleModelCount: 0 });
    } catch (e: any) {
      alert(e?.message ?? '식구 검색 실패');
    } finally {
      setLoading(false);
    }
  };

  /** ✅ 남/여 모델작업 count를 DB에서 정확히 계산 */
  const loadModelGenderCounts = async (userId: string) => {
    const maleVals = ['male', 'm', '남자', '남'];
    const femaleVals = ['female', 'f', '여자', '여'];

    const m = await supabase
      .from(MODEL_WORK_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('gender', maleVals);

    if (m.error) throw m.error;

    const f = await supabase
      .from(MODEL_WORK_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('gender', femaleVals);

    if (f.error) throw f.error;

    return {
      male: Number(m.count ?? 0),
      female: Number(f.count ?? 0),
    };
  };

  const loadUserDetail = async (u: ProfileRow) => {
    try {
      setSelected(u);
      setDetailLoading(true);
      setHomeworkPosts([]);
      setModelPosts([]);
      setSummary({ attendanceRate: 0, homeworkRate: 0, maleModelCount: 0, femaleModelCount: 0 });

      // 1) registrations(region/level)
      const { data: regs, error: regErr } = await supabase
        .from(ENROLL_REG_TABLE)
        .select('region, level')
        .eq('user_id', u.user_id);

      if (regErr) throw regErr;

      const pairs = (regs ?? [])
        .map((r: any) => ({
          region: String(r.region ?? '').trim(),
          level: String(r.level ?? '').trim(),
        }))
        .filter((x: any) => x.region && x.level);

      if (!pairs.length) return;

      // ✅ 기준: 등록한 강의 개수 × 9회(무조건)
      const denomFixed = pairs.length * 9;

      // 2) sessions
      const regions = Array.from(new Set(pairs.map((p) => p.region)));
      const levels = Array.from(new Set(pairs.map((p) => p.level)));

      const { data: sess, error: sErr } = await supabase
        .from(SESSIONS_TABLE)
        .select('id,title,start_at,end_at,region,level,session_no')
        .in('region', regions)
        .in('level', levels);

      if (sErr) throw sErr;

      const allowed = new Set(pairs.map((p) => `${p.region}|${p.level}`));
      const sessionsAll = (sess ?? []).filter((s: any) =>
        allowed.has(`${String(s.region ?? '').trim()}|${String(s.level ?? '').trim()}`)
      ) as SessionRow[];

      // ✅ 세션은 "각 (region|level) 강의별로 9개"만 대상으로 잡기
      const sessionsForRate: SessionRow[] = [];
      pairs.forEach((p) => {
        const list = sessionsAll
          .filter(
            (s) => String(s.region ?? '').trim() === p.region && String(s.level ?? '').trim() === p.level
          )
          .sort((a, b) => Number(a.session_no ?? 0) - Number(b.session_no ?? 0));

        sessionsForRate.push(...list.slice(0, 9));
      });

      const sessionIdsForRate = sessionsForRate.map((s) => s.id);
      const sessionTitleById = new Map(sessionsForRate.map((s) => [s.id, s.title]));

      // 3) attendance (가능한 세션만 분자 집계)
      const { data: aRows, error: aErr } = await supabase
        .from(ATTEND_TABLE)
        .select('session_id,user_id,status,checked_at')
        .eq('user_id', u.user_id)
        .in('session_id', sessionIdsForRate.length ? sessionIdsForRate : ['00000000-0000-0000-0000-000000000000']);

      if (aErr) throw aErr;

      const attendedSet = new Set<string>();
      (aRows ?? []).forEach((r: any) => {
        const ok = isAttendedStatus(r?.status) || !!r?.checked_at;
        if (r?.session_id && ok) attendedSet.add(r.session_id);
      });

      // 4) homework (submitted_at 존재가 제출)
      const { data: hRows, error: hErr } = await supabase
        .from(HOMEWORK_TABLE)
        .select('session_id,user_id,url,note,submitted_at,media_urls')
        .eq('user_id', u.user_id)
        .in('session_id', sessionIdsForRate.length ? sessionIdsForRate : ['00000000-0000-0000-0000-000000000000']);

      if (hErr) throw hErr;

      const hwSet = new Set<string>();
      (hRows ?? []).forEach((r: any) => {
        const ok = !!r?.submitted_at;
        if (r?.session_id && ok) hwSet.add(r.session_id);
      });

      // ✅ homework 인스타 그리드 posts
      const hwPosts = (hRows ?? [])
        .filter((r: any) => !!r?.submitted_at)
        .map((r: HomeworkRow) => {
          const media = normalizeMediaUrls(r);
          return {
  id: `${r.session_id}-${r.submitted_at ?? ''}`,
  at: r.submitted_at ?? new Date().toISOString(),
  sessionTitle: sessionTitleById.get(r.session_id) ?? '세션',
  note: r.note ?? '',
  media,
};
        })
        .filter((p: any) => p.media.length > 0)
        .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 60);

      setHomeworkPosts(hwPosts);

await debugModelWorkFeed(u.user_id);
      
      // 5) model posts
      const { data: mRows, error: mErr } = await supabase
        .from(MODEL_WORK_TABLE)
        .select('id,user_id,gender,title,comment,media_urls,created_at')
        .eq('user_id', u.user_id)
        .order('created_at', { ascending: false })
        .limit(60);

      if (mErr) throw mErr;

      console.log('[model] raw mRows', mRows?.[0]);
      
      const mPosts = (mRows ?? [])
  .map((r: ModelWorkRow) => {
    const media = normalizeMediaUrls(r);
    return {
      id: String(r.id),
      at: String(r.created_at ?? new Date().toISOString()),
      title: String(r.title ?? '모델작업'),
      comment: r.comment ?? '',
      gender: normalizeGender(r.gender),
      media,
    };
  })
        .filter((p: any) => p.media.length > 0)
        .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 60);

      setModelPosts(mPosts);

      // ✅ 남/여 모델작업 count (DB exact)
      const { male, female } = await loadModelGenderCounts(u.user_id);

      // ✅ summary 계산 (모수는 "강의수×9" 고정)
      const attendanceRate = denomFixed ? Math.round((attendedSet.size / denomFixed) * 100) : 0;
      const homeworkRate = denomFixed ? Math.round((hwSet.size / denomFixed) * 100) : 0;

      setSummary({
        attendanceRate,
        homeworkRate,
        maleModelCount: male,
        femaleModelCount: female,
      });
    } catch (e: any) {
      console.error('[loadUserDetail] error:', e);
      alert(e?.message ?? '수강생 상세 로드 실패');
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (userId: string, status: 'approved' | 'rejected') => {
    if (!isAdmin) return;

    try {
      const res = await fetch('/api/admin/users/status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: userId, status }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'status update failed');

      setResults((prev) => prev.map((u) => (u.user_id === userId ? { ...u, status } : u)));

      if (selected?.user_id === userId) {
        const updatedSelected = { ...selected, status };
        setSelected(updatedSelected);
        await loadUserDetail(updatedSelected);
      }
    } catch (e: any) {
      alert(e?.message ?? '승인/거절 실패');
    }
  };

  const activeGrid = feedTab === 'model' ? modelPosts : homeworkPosts;

  // ✅ 승인된 사람은 버튼 숨김 (pending/rejected/suspended/null 만 노출)
  const shouldShowAdminActions = (u: ProfileRow) =>
  showAdminActions && isAdmin && u.status !== 'approved';

  return (
    <>
    <section className="bg-white rounded-2xl border border-neutral-100 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-neutral-900">식구 검색</div>
          <div className="text-xs text-neutral-500 mt-0.5">이름/이메일/전화번호로 검색할 수 있어요.</div>
        </div>
        {loading && <span className="text-xs text-neutral-500">검색중…</span>}
      </div>

      {/* 검색바 */}
      <div className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch();
          }}
          placeholder="예) 김해피 / kimhappy@gmail.com / 010-1234-5678"
          className="flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={runSearch}
          className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm hover:bg-neutral-800"
        >
          검색
        </button>
      </div>

      {/* 결과 리스트 */}
      <div className="mt-3 grid grid-cols-1 gap-2">
        {results.length === 0 ? (
          <div className="text-sm text-neutral-500 py-6 text-center">검색 결과가 없습니다.</div>
        ) : (
          results.map((u) => {
            const isSelected = selected?.user_id === u.user_id;

            return (
              <div
                key={u.user_id}
                onClick={() => loadUserDetail(u)}
                className={cn(
                  'relative rounded-2xl border p-4 flex items-start justify-between gap-3 cursor-pointer transition',
                  isSelected ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-100 bg-white hover:bg-neutral-50'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 truncate">
                      <Highlight text={u.name ?? '이름없음'} q={qMemo} />
                    </div>

                    {isSelected && (
                      <span className="shrink-0 text-[11px] px-2 py-[2px] rounded-full border bg-neutral-900 text-white border-neutral-900">
                        선택됨
                      </span>
                    )}

                    <StatusPill status={u.status} />
                  </div>

                  <div className="mt-1 text-xs text-neutral-600 truncate">
                    <Highlight text={u.email ?? '이메일 없음'} q={qMemo} />
                    {u.phone ? (
                      <>
                        {' · '}
                        <Highlight text={u.phone} q={qMemo} />
                      </>
                    ) : null}
                  </div>

                  {u.role && <div className="mt-1 text-[11px] text-neutral-400">역할: {u.role}</div>}
                </div>

                {/* ✅ 파스텔톤 + 승인된 사람은 버튼 숨김 */}
                {shouldShowAdminActions(u) && (
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateStatus(u.user_id, 'approved');
                      }}
                      className={cn(
                        'px-3 py-2 rounded-xl text-xs font-semibold transition',
                        'bg-emerald-50 text-emerald-700 border border-emerald-100',
                        'hover:bg-emerald-100 active:bg-emerald-200'
                      )}
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateStatus(u.user_id, 'rejected');
                      }}
                      className={cn(
                        'px-3 py-2 rounded-xl text-xs font-semibold transition',
                        'bg-rose-50 text-rose-700 border border-rose-100',
                        'hover:bg-rose-100 active:bg-rose-200'
                      )}
                    >
                      거절
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 상세 */}
      {selected && (
        <div ref={detailRef} className="mt-4 border-t border-neutral-100 pt-4">
          <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
            <div className="text-xs text-neutral-500">선택된 수강생</div>
            <div className="mt-1 flex items-center gap-2 min-w-0">
              <div className="text-sm font-semibold text-neutral-900 truncate">{selected.name ?? '이름없음'}</div>
              <StatusPill status={selected.status} />
              {detailLoading && <span className="text-xs text-neutral-500">불러오는 중…</span>}
            </div>
            <div className="mt-1 text-xs text-neutral-600 truncate">
              {selected.email ?? '이메일 없음'}
              {selected.phone ? ` · ${selected.phone}` : ''}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold text-neutral-900">수강생 요약</div>

            {/* ✅ 4칸 */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="rounded-2xl border border-neutral-100 p-4 bg-white">
                <div className="text-xs text-neutral-500">출석률</div>
                <div className="mt-1 text-xl font-semibold text-neutral-900">{summary.attendanceRate}%</div>
                <div className="mt-1 text-[11px] text-neutral-500">등록 강의 수 × 9회 기준</div>
              </div>

              <div className="rounded-2xl border border-neutral-100 p-4 bg-white">
                <div className="text-xs text-neutral-500">과제 제출률</div>
                <div className="mt-1 text-xl font-semibold text-neutral-900">{summary.homeworkRate}%</div>
                <div className="mt-1 text-[11px] text-neutral-500">등록 강의 수 × 9회 기준</div>
              </div>

              <div className="rounded-2xl border border-neutral-100 p-4 bg-white">
                <div className="text-xs text-neutral-500">남자 모델작업</div>
                <div className="mt-1 text-xl font-semibold text-neutral-900">{summary.maleModelCount}개</div>
              </div>

              <div className="rounded-2xl border border-neutral-100 p-4 bg-white">
                <div className="text-xs text-neutral-500">여자 모델작업</div>
                <div className="mt-1 text-xl font-semibold text-neutral-900">{summary.femaleModelCount}개</div>
              </div>
            </div>

            {/* ✅ 인스타형 피드 */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-900">활동 피드</div>

                <div className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setFeedTab('model')}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-lg transition',
                      feedTab === 'model' ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-50'
                    )}
                  >
                    모델작업
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedTab('homework')}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-lg transition',
                      feedTab === 'homework' ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-50'
                    )}
                  >
                    과제
                  </button>
                </div>
              </div>

              <div className="mt-3">
                {detailLoading ? (
                  <div className="text-sm text-neutral-500 py-10 text-center">불러오는 중…</div>
                ) : activeGrid.length === 0 ? (
                  <div className="text-sm text-neutral-500 py-10 text-center">게시물이 없어요.</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {activeGrid.map((p: any) => {
                      const thumb = p.media?.[0];
                      const label =
                        feedTab === 'model'
                          ? p.gender === 'male'
                            ? '남자'
                            : p.gender === 'female'
                            ? '여자'
                            : '모델'
                          : '과제';

                      const title = feedTab === 'model' ? p.title : p.sessionTitle;

                      return (
                        <div
  key={p.id}
  className="group cursor-pointer"
  onClick={() =>
    setViewer({
      open: true,
      image: p.media?.[0],
      title: feedTab === 'model' ? p.title : p.sessionTitle,
      comment: feedTab === 'model' ? p.comment : p.note,
      date: p.at,
    })
  }
>
                          <div className="relative w-full overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 aspect-[3/4]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={thumb}
                              alt={title}
                              className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                              loading="lazy"
                            />
                            <div className="absolute left-2 top-2 rounded-full bg-black/65 text-white text-[11px] px-2 py-1">
                              {label}
                            </div>
                            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 via-black/10 to-transparent">
                              <div className="text-white text-[12px] font-semibold line-clamp-1">{title}</div>
                              <div className="text-white/85 text-[11px] mt-0.5">
                                {new Date(p.at).toLocaleDateString('ko-KR')}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
    {viewer?.open && (
      <div
        className="fixed inset-0 z-[999] bg-black/70 flex items-center justify-center px-4"
        onClick={() => setViewer(null)}
      >
        <div
          className="w-full max-w-md bg-white rounded-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 이미지 */}
          <div className="relative w-full aspect-[3/4] bg-black">
            <img
              src={viewer.image ?? ''}
              alt={viewer.title}
              className="w-full h-full object-contain"
            />
            <button
              onClick={() => setViewer(null)}
              className="absolute top-3 right-3 text-white bg-black/60 rounded-full px-3 py-1 text-sm"
            >
              ✕
            </button>
          </div>

          {/* 텍스트 */}
          <div className="p-4">
            <div className="text-sm font-semibold text-neutral-900">
              {viewer.title}
            </div>

            {viewer.date && (
              <div className="text-[11px] text-neutral-400 mt-0.5">
                {new Date(viewer.date).toLocaleDateString('ko-KR')}
              </div>
            )}

            {viewer.comment && (
              <div className="mt-3 text-sm text-neutral-700 whitespace-pre-line">
                {viewer.comment}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </>
);
}