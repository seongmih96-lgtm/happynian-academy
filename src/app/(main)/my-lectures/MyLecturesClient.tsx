'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { cn, formatKoreanDate, formatTimeRange } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type SessionInstructorItem = {
  user_id: string;
  name?: string | null;
  role?: string | null; // main | sub | null
  sort_order?: number | null;
  period_no?: number | null;
};

type PeriodInfo = {
  period_no: 1 | 2 | 3;
  title?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  instructors: SessionInstructorItem[];
};

type SessionRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  region?: string | null;
  level?: string | null;
  session_no?: number | null;

  periods?: Record<1 | 2 | 3, PeriodInfo>;

  classroom_url?: string | null;
  zoom_url?: string | null;
  materials_url?: string | null;
  materials?: string | null;
  notes?: string | null;
};

type Profile = {
  user_id: string;
  name?: string | null;
  role?: string | null;
};

type Props = {
  profile: Profile | null;
};

function formatInstructors(items?: SessionInstructorItem[] | null) {
  const list = (items ?? [])
    .filter(Boolean)
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));

  if (!list.length) return '';

  return list
    .map((x) => {
      const n = String(x.name ?? '').trim();
      if (!n) return '';
      const tag = String(x.role ?? '').toLowerCase() === 'sub' ? ' (서브)' : '';
      return `${n}${tag}`;
    })
    .filter(Boolean)
    .join(' · ');
}

const ATTEND_TABLE = 'session_attendance';
const HOMEWORK_TABLE = 'session_homework_submissions';

function openUrl(url?: string | null) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function getDdayBadge(startAt?: string | null, endAt?: string | null) {
  if (!startAt) return null;

  const now = Date.now();
  const start = new Date(startAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : null;

  if (end && start <= now && now <= end) return { label: '진행중', tone: 'live' as const };

  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);

  const start0 = new Date(start);
  start0.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((start0.getTime() - today0.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { label: 'D-Day', tone: 'dday' as const };
  if (diffDays > 0 && diffDays <= 3) return { label: `D-${diffDays}`, tone: 'soon' as const };

  return null;
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-[0_1px_0_0_rgba(0,0,0,0.02)]">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">{value}</div>
      <div className="mt-1 text-[11px] text-neutral-500">{sub}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white px-3 py-2">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function MiniBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'px-2 py-2 rounded-xl text-xs border transition active:scale-[0.99]',
        disabled
          ? 'bg-neutral-100 text-neutral-400 border-neutral-100'
          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
      )}
    >
      {children}
    </button>
  );
}

function SectionCard({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-neutral-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral-900">{title}</div>
        </div>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function StudentList({
  title,
  userIds,
  profiles,
}: {
  title: string;
  userIds: string[];
  profiles: Record<string, any>;
}) {
  const sorted = [...userIds].sort((a, b) => {
    const an = (profiles?.[a]?.name ?? '').toString();
    const bn = (profiles?.[b]?.name ?? '').toString();
    return an.localeCompare(bn, 'ko');
  });

  return (
    <div className="rounded-2xl border border-neutral-100 p-4 bg-white">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="text-xs text-neutral-500">{sorted.length}명</div>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-2 text-xs text-neutral-500">아직 등록된 수강생이 없어요.</div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2">
          {sorted.map((uid) => {
            const p = profiles?.[uid];
            const name = (p?.name ?? '이름없음').toString();
            const phone = p?.phone ? String(p.phone) : '';

            return (
              <div
                key={uid}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm text-neutral-900 truncate">{name}</div>
                  <div className="text-[11px] text-neutral-500">
                    {phone ? `📞 ${phone}` : '📞 전화번호 없음'}
                  </div>
                </div>

                <div className="text-[11px] px-2 py-1 rounded-full bg-neutral-100 text-neutral-700">
                  수강중
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NeedList({
  title,
  userIds,
  profiles,
}: {
  title: string;
  userIds: string[];
  profiles: Record<string, any>;
}) {
  return (
    <div className="rounded-2xl border border-neutral-100 p-4 bg-white">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="text-xs text-neutral-500">{userIds.length}명</div>
      </div>

      {userIds.length === 0 ? (
        <div className="mt-2 text-xs text-neutral-500">오늘은 완벽 ✅</div>
      ) : (
        <div className="mt-3 space-y-2">
          {userIds.map((uid) => {
            const p = profiles?.[uid];
            const name = (p?.name ?? '이름없음').toString();
            const phone = p?.phone ? String(p.phone) : '';

            return (
              <div key={uid} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-neutral-900 truncate">{name}</div>
                  <div className="text-[11px] text-neutral-500">
                    {phone ? `📞 ${phone}` : '📞 전화번호 없음'}
                  </div>
                </div>

                <button
                  type="button"
                  disabled
                  className="px-3 py-2 rounded-xl bg-neutral-200 text-neutral-500 text-xs"
                  title="추후 알림톡 연동 예정"
                >
                  리마인드
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}export default function MyLecturesClient({ profile }: Props) {
  const router = useRouter();

  const roleFromProp = String(profile?.role ?? '').trim().toLowerCase();
  const isAdmin = roleFromProp === 'admin' || roleFromProp === 'instructor';

  const TZ = 'Asia/Seoul';
  const ymdKst = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
  const ymKst = (iso: string) => ymdKst(iso).slice(0, 7);
  const thisYmKst = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7);

  const [sortMode, setSortMode] = useState<'nearest' | 'oldest'>('nearest');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [myUid, setMyUid] = useState<string>('');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const sessionIds = useMemo(() => sessions.map((s) => s.id), [sessions]);
  const sessionIdsKey = useMemo(() => sessionIds.join(','), [sessionIds]);

  const [attendRows, setAttendRows] = useState<any[]>([]);
  const [homeworkRows, setHomeworkRows] = useState<any[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<Record<string, any>>({});
  const [studentsBySession, setStudentsBySession] = useState<Record<string, string[]>>({});

  // ✅ 1) 로그인 유저 + "내 session" 로드
  useEffect(() => {
    let alive = true;

    const run = async () => {
      setLoading(true);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!user) {
        if (!alive) return;
        setLoading(false);
        router.replace('/login');
        return;
      }

      setMyUid(user.id);

      const { data: mySess, error: mySessErr } = await supabase.from('v_my_sessions').select('session_id');

      if (!alive) return;

      if (mySessErr) {
        console.error('[my-lectures] v_my_sessions load error:', mySessErr);
        setSessions([]);
        setLoading(false);
        return;
      }

      const ids = (mySess ?? []).map((r: any) => r.session_id).filter(Boolean);
      if (!ids.length) {
        setSessions([]);
        setLoading(false);
        return;
      }

      const { data: sData, error: sErr } = await supabase
        .from('sessions')
        .select('id, title, start_at, end_at, region, level, session_no, classroom_url, zoom_url, materials_url, materials, notes')
        .in('id', ids);

      if (sErr) {
        console.error('[my-lectures] sessions load error:', sErr);
        setSessions([]);
        setLoading(false);
        return;
      }

      const list = (sData ?? []).filter(Boolean) as SessionRow[];

      setSessions((prev) => {
        const prevById: Record<string, SessionRow> = {};
        (prev ?? []).forEach((p) => {
          if (p?.id) prevById[p.id] = p;
        });

        return list
          .map((s) => ({
            ...s,
            periods: prevById[s.id]?.periods ?? s.periods,
          }))
          .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
      });

      setLoading(false);
    };

    run();
    return () => {
      alive = false;
    };
  }, [router]);

  // ✅ 2) 교시 + 교시별 강사 붙이기 (view 한방)
  useEffect(() => {
    const run = async () => {
      if (!sessions.length) return;

      const already = sessions.every((s) => Boolean(s.periods));
      if (already) return;

      const ids = sessions.map((s) => s.id).filter(Boolean);
      if (!ids.length) return;

      const { data, error } = await supabase
        .from('v_session_instructor_periods')
        .select('session_id, period_no, period_title, period_start_at, period_end_at, instructor_user_id, instructor_name, role')
        .in('session_id', ids);

      if (error) {
        console.error('[my-lectures] v_session_instructor_periods load error:', error);
        return;
      }

      const bySessionPeriods: Record<string, Record<1 | 2 | 3, PeriodInfo>> = {};

      ids.forEach((sid) => {
        bySessionPeriods[sid] = {
          1: { period_no: 1, title: null, start_at: null, end_at: null, instructors: [] },
          2: { period_no: 2, title: null, start_at: null, end_at: null, instructors: [] },
          3: { period_no: 3, title: null, start_at: null, end_at: null, instructors: [] },
        };
      });

      (data ?? []).forEach((r: any) => {
        const sid = String(r.session_id ?? '');
        const pn = Number(r.period_no) as 1 | 2 | 3;
        if (!sid || !(pn === 1 || pn === 2 || pn === 3)) return;

        bySessionPeriods[sid][pn].title = r.period_title ?? null;
        bySessionPeriods[sid][pn].start_at = r.period_start_at ?? null;
        bySessionPeriods[sid][pn].end_at = r.period_end_at ?? null;

        bySessionPeriods[sid][pn].instructors.push({
          user_id: String(r.instructor_user_id ?? ''),
          name: r.instructor_name ?? null,
          role: r.role ?? null,
          sort_order: null,
          period_no: pn,
        });
      });

      Object.values(bySessionPeriods).forEach((periods) => {
        ([1, 2, 3] as const).forEach((pn) => {
          periods[pn].instructors = [...periods[pn].instructors].sort(
            (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
          );
        });
      });

      setSessions((prev) =>
        (prev ?? []).map((s) => ({
          ...s,
          periods: bySessionPeriods[s.id] ?? {
            1: { period_no: 1, title: null, start_at: null, end_at: null, instructors: [] },
            2: { period_no: 2, title: null, start_at: null, end_at: null, instructors: [] },
            3: { period_no: 3, title: null, start_at: null, end_at: null, instructors: [] },
          },
        }))
      );
    };

    run();
  }, [sessions]);

  // ✅ 3) 출석/과제 rows 로드
  useEffect(() => {
    const run = async () => {
      if (!sessionIds.length) {
        setAttendRows([]);
        setHomeworkRows([]);
        return;
      }

      const { data: aData, error: aErr } = await supabase
        .from(ATTEND_TABLE)
        .select('session_id, user_id, status')
        .in('session_id', sessionIds);

      if (aErr) {
        console.error('[my-lectures] attendance load error:', aErr);
        setAttendRows([]);
      } else {
        setAttendRows(aData ?? []);
      }

      const { data: hData, error: hErr } = await supabase
        .from(HOMEWORK_TABLE)
        .select('session_id, user_id, submitted_at')
        .in('session_id', sessionIds);

      if (hErr) {
        console.error('[my-lectures] homework load error:', hErr);
        setHomeworkRows([]);
      } else {
        setHomeworkRows(hData ?? []);
      }
    };

    run();
  }, [sessionIdsKey, sessionIds]);

  // ✅ session별 수강생 매칭
  useEffect(() => {
    const run = async () => {
      if (!sessions.length) {
        setStudentsBySession({});
        setStudentProfiles({});
        return;
      }

      const pairKeys = new Set<string>();
      sessions.forEach((s) => {
        const r = String(s.region ?? '').trim();
        const l = String(s.level ?? '').trim();
        if (r && l) pairKeys.add(`${r}|${l}`);
      });

      if (!pairKeys.size) {
        setStudentsBySession({});
        setStudentProfiles({});
        return;
      }

      const regions = Array.from(new Set(Array.from(pairKeys).map((k) => k.split('|')[0])));
      const levels = Array.from(new Set(Array.from(pairKeys).map((k) => k.split('|')[1])));

      const { data: regs, error: regErr } = await supabase
        .from('my_lecture_registrations')
        .select('user_id, region, level')
        .in('region', regions)
        .in('level', levels);

      if (regErr) {
        console.error('[my-lectures] registrations load error:', regErr);
        setStudentsBySession({});
        setStudentProfiles({});
        return;
      }

      const regRows = (regs ?? [])
        .map((r: any) => ({
          user_id: String(r.user_id ?? '').trim(),
          region: String(r.region ?? '').trim(),
          level: String(r.level ?? '').trim(),
        }))
        .filter((x) => x.user_id && x.region && x.level && pairKeys.has(`${x.region}|${x.level}`));

      const pool: Record<string, string[]> = {};
      regRows.forEach((r) => {
        const key = `${r.region}|${r.level}`;
        if (!pool[key]) pool[key] = [];
        pool[key].push(r.user_id);
      });

      const bySession: Record<string, string[]> = {};
      sessions.forEach((s) => {
        const key = `${String(s.region ?? '').trim()}|${String(s.level ?? '').trim()}`;
        bySession[s.id] = pool[key] ?? [];
      });
      setStudentsBySession(bySession);

      const allUserIds = Array.from(new Set(regRows.map((r) => r.user_id)));
      if (!allUserIds.length) {
        setStudentProfiles({});
        return;
      }

      const { data: profs, error: pErr } = await supabase
        .from('profiles')
        .select('user_id,name,phone,role,status')
        .in('user_id', allUserIds);

      if (pErr) {
        console.error('[my-lectures] student profiles load error:', pErr);
        setStudentProfiles({});
        return;
      }

      const profileMap: Record<string, any> = {};
      (profs ?? []).forEach((p: any) => {
        if (p?.user_id) profileMap[p.user_id] = p;
      });
      setStudentProfiles(profileMap);
    };

    run();
  }, [sessions]);

  // ✅ enroll/attend/homework map
  const enrollMap = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    Object.entries(studentsBySession ?? {}).forEach(([sessionId, ids]) => {
      m[sessionId] = new Set((ids ?? []).filter(Boolean));
    });
    return m;
  }, [studentsBySession]);

  const attendMap = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    (attendRows ?? []).forEach((r: any) => {
      if (!r?.session_id || !r?.user_id) return;
      const cohort = enrollMap[r.session_id];
      if (!cohort || !cohort.has(r.user_id)) return;

      const status = String(r.status ?? '').toLowerCase();
      const ok = status === 'present' || status === 'checked' || status === 'attended';
      if (!ok) return;

      if (!m[r.session_id]) m[r.session_id] = new Set();
      m[r.session_id].add(r.user_id);
    });
    return m;
  }, [attendRows, enrollMap]);

  const homeworkMap = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    (homeworkRows ?? []).forEach((r: any) => {
      if (!r?.session_id || !r?.user_id) return;
      const cohort = enrollMap[r.session_id];
      if (!cohort || !cohort.has(r.user_id)) return;

      const ok = Boolean(r.submitted_at);
      if (!ok) return;

      if (!m[r.session_id]) m[r.session_id] = new Set();
      m[r.session_id].add(r.user_id);
    });
    return m;
  }, [homeworkRows, enrollMap]);

  // ✅ KPI
  const kpi = useMemo(() => {
    const monthKey = thisYmKst();

    const monthSessions = (sessions ?? []).filter((s) => s?.start_at && ymKst(s.start_at) === monthKey);

    const uniqueDays = new Set<string>();
    monthSessions.forEach((s) => uniqueDays.add(ymdKst(s.start_at)));
    const monthLectureCount = uniqueDays.size;

    let denomA = 0, numerA = 0;
    let denomH = 0, numerH = 0;

    monthSessions.forEach((s) => {
      const enrolled = enrollMap[s.id] ?? new Set<string>();
      const attended = attendMap[s.id] ?? new Set<string>();
      const submitted = homeworkMap[s.id] ?? new Set<string>();

      denomA += enrolled.size;
      numerA += attended.size;

      denomH += enrolled.size;
      numerH += submitted.size;
    });

    const attendanceRate = denomA ? Math.round((numerA / denomA) * 100) : 0;
    const homeworkRate = denomH ? Math.round((numerH / denomH) * 100) : 0;

    return { monthLectureCount, attendanceRate, homeworkRate };
  }, [sessions, enrollMap, attendMap, homeworkMap]);

  // ✅ 해야 할 사람
  const mustDoBySession = useMemo(() => {
    const m: Record<string, { missingAttendance: string[]; missingHomework: string[] }> = {};

    sessions.forEach((s) => {
      const enrolled = enrollMap[s.id] ?? new Set<string>();
      const attended = attendMap[s.id] ?? new Set<string>();
      const submitted = homeworkMap[s.id] ?? new Set<string>();

      const missingAttendance: string[] = [];
      const missingHomework: string[] = [];

      enrolled.forEach((uid) => {
        if (!attended.has(uid)) missingAttendance.push(uid);
        if (!submitted.has(uid)) missingHomework.push(uid);
      });

      m[s.id] = { missingAttendance, missingHomework };
    });

    return m;
  }, [sessions, enrollMap, attendMap, homeworkMap]);

  // ✅ 정렬
  const sortedMySessions = useMemo(() => {
    const now = Date.now();
    const list = [...(sessions ?? [])];

    if (sortMode === 'nearest') {
      return list.sort((a, b) => {
        const aTime = new Date(a.start_at).getTime();
        const bTime = new Date(b.start_at).getTime();

        const aDiff = aTime >= now ? aTime - now : Number.MAX_SAFE_INTEGER;
        const bDiff = bTime >= now ? bTime - now : Number.MAX_SAFE_INTEGER;

        if (aDiff !== bDiff) return aDiff - bDiff;
        return aTime - bTime;
      });
    }

    return list.sort((a, b) => {
      const aTime = new Date(a.start_at).getTime();
      const bTime = new Date(b.start_at).getTime();

      const aPast = aTime <= now;
      const bPast = bTime <= now;

      if (aPast && !bPast) return -1;
      if (!aPast && bPast) return 1;

      if (aPast && bPast) return bTime - aTime;
      return aTime - bTime;
    });
  }, [sessions, sortMode]);

  const headerTitle = '내 강의';
  const headerSub = '내가 맡은 강의만 모아, 오늘의 성장 흐름을 한눈에 🌿';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-sm text-neutral-700">
          접근 권한이 없어요.
        </div>
      </div>
    );
  }  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-neutral-50/90 backdrop-blur border-b border-neutral-100">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">{headerTitle}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{headerSub}</div>
            </div>

            {loading && (
              <div className="text-xs text-neutral-500 px-3 py-1 rounded-full bg-white border border-neutral-100">
                불러오는 중…
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 py-4 space-y-4">
        {/* KPI */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-neutral-900">이번달 내 강의 리더보드</div>
                <span className="text-[11px] px-2 py-[2px] rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                  리더 모드
                </span>
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                “완벽”보다 “지속”. 식구들이 끝까지 가게 돕는 게 리더의 힘 💛
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
            <KpiCard label="이번달 내 강의" value={`${kpi.monthLectureCount}개`} sub="날짜 기준(같은 날 여러 교시=1개)" />
            <KpiCard label="총 출석률" value={`${kpi.attendanceRate}%`} sub="이번달 내 강의 기준" />
            <KpiCard label="총 과제제출률" value={`${kpi.homeworkRate}%`} sub="이번달 내 강의 기준" />
          </div>
        </section>

        {/* Sort */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-neutral-500">
            {sortMode === 'nearest' ? '다가오는 강의부터 준비해요 🌿' : '지나온 강의를 차근차근 되짚어요 📚'}
          </div>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as any)}
            className="text-xs border border-neutral-200 rounded-xl px-3 py-2 bg-white"
          >
            <option value="nearest">가까운순 ⭐</option>
            <option value="oldest">오래된순</option>
          </select>
        </div>

        {/* List */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-neutral-900">내 강의 목록</div>
              <div className="text-xs text-neutral-500 mt-0.5">
                “해야 할 사람”을 먼저 살피면, 강의의 분위기가 달라져요 🙂
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {sortedMySessions.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-sm font-medium text-neutral-800">아직 ‘내 강의’가 없어요</div>
                <div className="mt-2 text-xs text-neutral-500">
                  session_instructors에 내 계정이 교시 강사로 배정되어 있어야 해요.
                </div>
              </div>
            ) : (
              sortedMySessions.map((s) => {
                const enrolled = enrollMap[s.id]?.size ?? 0;
                const attended = attendMap[s.id]?.size ?? 0;
                const submitted = homeworkMap[s.id]?.size ?? 0;

                const attendRate = enrolled ? Math.round((attended / enrolled) * 100) : 0;
                const hwRate = enrolled ? Math.round((submitted / enrolled) * 100) : 0;

                const must = mustDoBySession[s.id] ?? { missingAttendance: [], missingHomework: [] };
                const isOpen = expandedId === s.id;
                const badge = getDdayBadge(s.start_at, s.end_at);

                return (
                  <div
                    key={s.id}
                    className={cn(
                      'border rounded-2xl p-4 transition',
                      isOpen ? 'border-neutral-200 bg-neutral-50/40' : 'border-neutral-100 bg-white hover:bg-neutral-50/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* left */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-sm font-semibold text-neutral-900 truncate">{s.title}</div>

                          {badge && (
                            <span
                              className={[
                                'shrink-0 text-[11px] px-2 py-[2px] rounded-full border',
                                badge.tone === 'live' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : '',
                                badge.tone === 'dday' ? 'bg-rose-50 text-rose-700 border-rose-100' : '',
                                badge.tone === 'soon' ? 'bg-amber-50 text-amber-700 border-amber-100' : '',
                              ].join(' ')}
                            >
                              {badge.label}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-700">
                            {s.region ?? '지역 미지정'}
                          </span>
                          <span className="px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-700">
                            {s.level ?? '레벨 미지정'}
                          </span>
                          <span className="px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-700">
                            {`회차 ${s.session_no ?? 0}`}
                          </span>

                          <span className="text-neutral-300">·</span>
                          <span>{formatKoreanDate(s.start_at)}</span>
                          <span className="text-neutral-300">·</span>
                          <span>{formatTimeRange(s.start_at, s.end_at)}</span>
                        </div>

                        {/* periods */}
                        {s.periods && (
                          <div className="mt-3 rounded-xl border border-neutral-100 bg-white p-3">
                            <div className="text-[11px] text-neutral-500 mb-2">교시 정보</div>
                            <div className="space-y-1.5">
                              {([1, 2, 3] as const).map((pn) => {
                                const p = s.periods?.[pn];
                                const title = String(p?.title ?? '').trim();
                                const teacher = formatInstructors(p?.instructors ?? []);

                                return (
                                  <div key={pn} className="text-xs text-neutral-700 flex items-start gap-2">
                                    <span className="shrink-0 w-10 text-neutral-500">{pn}교시</span>
                                    <div className="min-w-0">
                                      <div className={cn('truncate', !title && 'text-neutral-400')}>
                                        {title ? `「${title}」` : '강의명 미지정'}
                                      </div>
                                      <div className={cn('text-[11px] mt-0.5', !teacher ? 'text-neutral-400' : 'text-neutral-500')}>
                                        {teacher ? teacher : '강사 미지정'}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <MiniStat label="등록" value={`${enrolled}명`} />
                          <MiniStat label="출석" value={`${attendRate}%`} />
                          <MiniStat label="과제" value={`${hwRate}%`} />
                        </div>
                      </div>

                      {/* right actions */}
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <div className="grid grid-cols-3 gap-1">
                          <MiniBtn disabled={!s.classroom_url} onClick={() => openUrl(s.classroom_url)}>
                            영상
                          </MiniBtn>
                          <MiniBtn disabled={!s.zoom_url} onClick={() => openUrl(s.zoom_url)}>
                            줌
                          </MiniBtn>
                          <MiniBtn disabled={!s.materials_url} onClick={() => openUrl(s.materials_url)}>
                            자료
                          </MiniBtn>
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedId((prev) => (prev === s.id ? null : s.id))}
                          className={cn(
                            'px-3 py-2 rounded-xl border text-sm w-[120px] transition active:scale-[0.99]',
                            isOpen
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-50'
                          )}
                        >
                          {isOpen ? '접기' : '펼쳐보기'}
                        </button>
                      </div>
                    </div>

                    {/* expanded */}
                    {isOpen && (
                      <div className="border-t border-neutral-100 pt-4 mt-4 space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                          <div className="rounded-2xl border border-neutral-100 bg-white p-4">
                            <div className="text-xs font-semibold text-neutral-900">준비물</div>
                            <div className="mt-2 text-xs text-neutral-700 whitespace-pre-wrap">
                              {String(s.materials ?? '').trim() !== '' ? String(s.materials) : '아직 준비물이 등록되지 않았어요.'}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-neutral-100 bg-white p-4">
                            <div className="text-xs font-semibold text-neutral-900">비고</div>
                            <div className="mt-2 text-xs text-neutral-700 whitespace-pre-wrap">
                              {String(s.notes ?? '').trim() !== '' ? String(s.notes) : '추가 안내가 없어요.'}
                            </div>
                          </div>

                          <StudentList title="이 강의를 듣는 수강생" userIds={studentsBySession[s.id] ?? []} profiles={studentProfiles} />

                          <div className="rounded-2xl border border-neutral-100 bg-white p-4">
                            <div className="text-sm font-semibold text-neutral-900">해야 할 사람 리스트 ✅</div>
                            <div className="mt-3 space-y-3">
                              <NeedList title="출석 체크 안 한 식구" userIds={must.missingAttendance} profiles={studentProfiles} />
                              <NeedList title="과제 미제출 식구" userIds={must.missingHomework} profiles={studentProfiles} />
                            </div>

                            <div className="pt-3">
                              <button
                                type="button"
                                disabled
                                className="w-full rounded-xl px-4 py-3 text-sm font-medium bg-neutral-200 text-neutral-500"
                                title="추후 알림톡 연동 예정"
                              >
                                원클릭 리마인드(알림톡) — 준비중 🔔
                              </button>
                              <div className="mt-2 text-xs text-neutral-500">
                                다음 단계: phone/kakao_id 기반으로 서버 액션/edge function에서 알림톡 API 호출
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}