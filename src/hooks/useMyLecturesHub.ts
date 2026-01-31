'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export type ResourceTab = 'video' | 'zoom' | 'materials';

type SessionRow = {
  id: string;
  title?: string | null;
  instructor?: string | null;

  start_at?: string | null;
  end_at?: string | null;

  classroom_url?: string | null;
  zoom_url?: string | null;
  materials_url?: string | null;

  region?: string | null;
  level?: string | null;
  session_no?: number | null; // ✅ round 대신

  created_at?: string | null;
  updated_at?: string | null;
};

type ProfileRow = {
  user_id: string;
  name?: string | null; // ✅ 너희 profiles 이름 컬럼명이 다르면 여기/아래 myName만 수정
};

type EnrollmentRow = { session_id: string; user_id: string };
type AttendanceRow = { session_id: string; user_id: string; status?: string | null; checked_at?: string | null };
type HomeworkRow = { session_id: string; user_id: string; url?: string | null; note?: string | null; submitted_at?: string | null };

type Detail = {
  enrolledIds: string[];
  attendanceIds: string[];
  homeworkIds: string[];
  attendance: AttendanceRow[];
  homework: HomeworkRow[];
  nameMap: Record<string, string>;
};

function normName(v?: string | null) {
  return (v ?? '').trim().replace(/\s+/g, '').toLowerCase();
}

// Asia/Seoul 기준 이번달 시작/끝 ISO
function thisMonthRangeSeoul() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const seoul = new Date(utc + 9 * 3600000);
  const y = seoul.getFullYear();
  const m = seoul.getMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export function useMyLecturesHub(profile?: ProfileRow) {
  const userId = profile?.user_id ?? null;
  const myName = useMemo(() => normName(profile?.name), [profile?.name]);

  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  // filters
  const [region, setRegion] = useState<string>('all');
  const [level, setLevel] = useState<string>('all');
  const [sessionNo, setSessionNo] = useState<string>('all'); // ✅ session_no

  // expand
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, Detail>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  // ✅ sessions load
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('sessions')
        .select(
          'id,title,instructor,start_at,end_at,classroom_url,zoom_url,materials_url,region,level,session_no,created_at,updated_at'
        );

      setLoading(false);
      if (error) {
        console.error('[my lectures] sessions load error:', error);
        return;
      }
      setSessions((data ?? []) as SessionRow[]);
    };

    run();
  }, []);

  // ✅ 내 강의만
  const mySessions = useMemo(() => {
    if (!myName) return [];
    return (sessions ?? []).filter((s) => normName(s.instructor) === myName);
  }, [sessions, myName]);

  // ✅ filter options
  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    mySessions.forEach((s) => s.region && set.add(s.region));
    return ['all', ...Array.from(set)];
  }, [mySessions]);

  const levelOptions = useMemo(() => {
    const set = new Set<string>();
    mySessions.forEach((s) => s.level && set.add(s.level));
    return ['all', ...Array.from(set)];
  }, [mySessions]);

  const sessionNoOptions = useMemo(() => {
    const set = new Set<string>();
    mySessions.forEach((s) => (s.session_no != null ? set.add(String(s.session_no)) : null));
    const arr = Array.from(set).sort((a, b) => Number(a) - Number(b));
    return ['all', ...arr];
  }, [mySessions]);

  // ✅ filtered list
  const filteredMySessions = useMemo(() => {
    return mySessions.filter((s) => {
      if (region !== 'all' && (s.region ?? '') !== region) return false;
      if (level !== 'all' && (s.level ?? '') !== level) return false;
      if (sessionNo !== 'all' && String(s.session_no ?? '') !== sessionNo) return false;
      return true;
    });
  }, [mySessions, region, level, sessionNo]);

  // ✅ helpers
  const getUrl = useCallback((s: SessionRow, tab: ResourceTab) => {
    if (tab === 'video') return s.classroom_url ?? '';
    if (tab === 'zoom') return s.zoom_url ?? '';
    return s.materials_url ?? '';
  }, []);

  const openUrl = useCallback((url?: string | null) => {
    const u = (url ?? '').trim();
    if (!u) return;
    window.open(u, '_blank', 'noopener,noreferrer');
  }, []);

  // ✅ 펼쳐보기 로드(해당 세션 1개)
  const loadDetail = useCallback(
    async (sessionId: string) => {
      if (!sessionId) return;
      if (detailMap[sessionId]) return;

      setDetailLoadingId(sessionId);

      // 1) enrollments
      const { data: enroll, error: e1 } = await supabase
        .from('session_enrollments')
        .select('session_id,user_id')
        .eq('session_id', sessionId);

      if (e1) {
        console.error('[my lectures] enroll load error:', e1);
        setDetailLoadingId(null);
        return;
      }

      const enrolledIds = Array.from(
        new Set((enroll ?? []).map((r: any) => String(r.user_id)).filter(Boolean))
      );

      // 2) attendance
      const { data: attendance, error: e2 } = await supabase
        .from('session_attendance')
        .select('session_id,user_id,status,checked_at')
        .eq('session_id', sessionId);

      if (e2) {
        console.error('[my lectures] attendance load error:', e2);
        setDetailLoadingId(null);
        return;
      }

      const attendanceIds = Array.from(
        new Set((attendance ?? []).map((r: any) => String(r.user_id)).filter(Boolean))
      );

      // 3) homework
      const { data: homework, error: e3 } = await supabase
        .from('session_homework_submissions')
        .select('session_id,user_id,url,note,submitted_at')
        .eq('session_id', sessionId);

      if (e3) {
        console.error('[my lectures] homework load error:', e3);
        setDetailLoadingId(null);
        return;
      }

      const homeworkIds = Array.from(
        new Set((homework ?? []).map((r: any) => String(r.user_id)).filter(Boolean))
      );

      // 4) profile names
      let nameMap: Record<string, string> = {};
      if (enrolledIds.length) {
        const { data: profs, error: e4 } = await supabase
          .from('profiles')
          .select('user_id,name')
          .in('user_id', enrolledIds);

        if (e4) {
          console.error('[my lectures] profiles load error:', e4);
        } else {
          (profs ?? []).forEach((p: any) => {
            if (!p?.user_id) return;
            nameMap[String(p.user_id)] = String(p.name ?? '이름없음');
          });
        }
      }

      setDetailMap((prev) => ({
        ...prev,
        [sessionId]: {
          enrolledIds,
          attendanceIds,
          homeworkIds,
          attendance: (attendance ?? []) as AttendanceRow[],
          homework: (homework ?? []) as HomeworkRow[],
          nameMap,
        },
      }));

      setDetailLoadingId(null);
    },
    [detailMap]
  );

  const toggleExpand = useCallback(
    async (sessionId: string) => {
      if (expandedId === sessionId) {
        setExpandedId(null);
        return;
      }
      setExpandedId(sessionId);
      await loadDetail(sessionId);
    },
    [expandedId, loadDetail]
  );

  // ✅ KPI 계산(내 강의 전체 + 이번달)
  const kpi = useMemo(() => {
    const { startISO, endISO } = thisMonthRangeSeoul();

    const monthSessions = mySessions.filter((s) => {
      const t = new Date(s.start_at ?? s.created_at ?? 0).toISOString();
      return t >= startISO && t < endISO;
    });

    // detail이 로드된 것만으로 KPI 계산하면 “펼쳐보기 안 누른 세션은 0”이 되므로,
    // KPI는 "총합 집계"를 위해 별도 로딩이 필요하지만, 우선은
    // ✅ 지금은 펼쳐본 세션 기준 KPI + (내 강의 개수는 전체 기준) 으로 제공
    // → 원하면 다음 단계에서 KPI 집계를 위한 서버/RPC로 개선 가능
    const allMyCount = mySessions.length;
    const monthCount = monthSessions.length;

    let totalStudentsSet = new Set<string>();
    let totalEnrolled = 0;
    let totalAttend = 0;
    let totalHomework = 0;

    Object.values(detailMap).forEach((d) => {
      totalEnrolled += d.enrolledIds.length;
      totalAttend += d.attendanceIds.length;
      totalHomework += d.homeworkIds.length;
      d.enrolledIds.forEach((id) => totalStudentsSet.add(id));
    });

    const attendanceRate = totalEnrolled > 0 ? Math.round((totalAttend / totalEnrolled) * 100) : 0;
    const homeworkRate = totalEnrolled > 0 ? Math.round((totalHomework / totalEnrolled) * 100) : 0;

    return {
      allMyCount,
      monthCount,
      studentCount: totalStudentsSet.size,
      attendanceRate,
      homeworkRate,
    };
  }, [mySessions, detailMap]);

  // ✅ “해야 할 사람” 계산
  const getTodoLists = useCallback(
    (sessionId: string) => {
      const d = detailMap[sessionId];
      if (!d) return { absentIds: [], homeworkMissingIds: [] };

      const enrolled = new Set(d.enrolledIds);
      const attended = new Set(d.attendanceIds);
      const hw = new Set(d.homeworkIds);

      const absentIds = Array.from(enrolled).filter((uid) => !attended.has(uid));
      const homeworkMissingIds = Array.from(enrolled).filter((uid) => !hw.has(uid));

      return { absentIds, homeworkMissingIds };
    },
    [detailMap]
  );

  // ✅ rows (정렬은 기본: 일정순)
  const rows = useMemo(() => {
    return [...filteredMySessions].sort((a, b) => {
      const ta = new Date(a.start_at ?? a.created_at ?? 0).getTime();
      const tb = new Date(b.start_at ?? b.created_at ?? 0).getTime();
      return ta - tb;
    });
  }, [filteredMySessions]);

  return {
    // auth/info
    userId,
    myName,

    // loading
    loading,

    // data
    rows,

    // filters
    region,
    setRegion,
    level,
    setLevel,
    sessionNo,
    setSessionNo,
    regionOptions,
    levelOptions,
    sessionNoOptions,

    // expand
    expandedId,
    detailMap,
    detailLoadingId,
    toggleExpand,
    getTodoLists,

    // helpers
    getUrl,
    openUrl,

    // KPI
    kpi,
  };
}