'use client';

import { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Star } from 'lucide-react';

import { Header } from '@/components/layout/Header';
import { FilterChips } from '@/components/ui/FilterChips';
import { SessionCard } from '@/components/session/SessionCard';
import { EmptyState } from '@/components/ui/EmptyState';

import type { Session, Profile, Favorite } from '@/types';
import { filterSessions, cn } from '@/lib/utils';

/* =========================
 UI TOKENS (디자인 통일)
========================= */
const UI = {
  page: 'min-h-screen bg-neutral-50',

  sectionHeaderRow: 'mb-2 flex items-center justify-between gap-2',
  sectionTitle: 'text-sm font-semibold text-neutral-900',

  pillBase: 'inline-flex items-center gap-1 text-[11px] px-2 py-[3px] rounded-full border',
  pillToday: 'bg-red-50 text-red-700 border-red-100',
  pillTomorrow: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  pillNotify: 'bg-blue-50 text-blue-700 border-blue-100',
  pillFav: 'bg-amber-50 text-amber-700 border-amber-100',

  toggleBtn:
    'w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border text-sm transition-colors',
  toggleOn: 'bg-neutral-900 border-neutral-900 text-white',
  toggleOff: 'bg-white border-neutral-200 text-neutral-900 hover:bg-neutral-50',
  toggleRight: 'flex items-center gap-2',
  toggleCountOn: 'bg-white/15 border border-white/25 text-white',
  toggleCountOff: 'bg-neutral-100 border border-neutral-200 text-neutral-600',
  toggleStateOn: 'bg-white/15 border border-white/25 text-white',
  toggleStateOff: 'bg-neutral-50 border border-neutral-200 text-neutral-600',

  moreBtn:
    'w-full px-4 py-2.5 rounded-2xl bg-white border border-neutral-200 text-sm hover:bg-neutral-50',

  // ✅ 상단 아이콘 배지
  iconBtn:
    'relative p-2 min-w-[44px] min-h-[44px] rounded-xl hover:bg-neutral-100 flex items-center justify-center',
  iconBadge:
    'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] leading-[18px] text-center',
};

const COLLAPSE_LIMIT = 5;

interface HomeContentProps {
  sessions: Session[];
  profile: Profile | null;
  favorites: Favorite[];
  // ✅ 추가: "DB에 존재하는 강의 레벨" (전체기간 기준)
  activeLevelKeys: string[];
}

export default function HomeContent({ sessions, profile, favorites, activeLevelKeys }: HomeContentProps) {
  const router = useRouter();

  /* =========================
   ✅ role (student/admin)
  ========================= */
  const role = profile?.role ?? 'student';
  const isAdmin = role === 'admin';

  /* =========================
   ✅ activeKeySet (삭제된 강의 자동 제외용)
  ========================= */
  const activeKeySet = useMemo(() => {
    return new Set((activeLevelKeys ?? []).filter(Boolean));
  }, [activeLevelKeys]);

  /* =========================
   기본 상태
  ========================= */
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [todayOnly, setTodayOnly] = useState(false);

  /* =========================
   ✅ 코치마크(온보딩) 상태 (전역 1회)
  ========================= */
  const [showCoachmark, setShowCoachmark] = useState(false);
  const [coachmarkSessionId, setCoachmarkSessionId] = useState<string | null>(null);
  const [coachmarkStep, setCoachmarkStep] = useState<1 | 2>(1);

  /* =========================
   즐겨찾기 / 알림 Set (✅ 삭제된 강의 자동 제외)
  ========================= */
  const [favoriteLevelKeys, setFavoriteLevelKeys] = useState<Set<string>>(new Set());
  const [notifyLevelKeys, setNotifyLevelKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fav = new Set<string>();
    const noti = new Set<string>();

    (favorites ?? []).forEach((f: any) => {
      const region = String(f?.region ?? '').trim();
      const level = String(f?.level ?? '').trim();
      if (!region || !level) return;

      const key = `${region}|${level}`;

      // ✅ 핵심: DB에 존재하는 강의 레벨만 인정
      if (!activeKeySet.has(key)) return;

      if (f?.is_favorite === true) fav.add(key);
      if (f?.notify_enabled === true) noti.add(key);
    });

    setFavoriteLevelKeys(fav);
    setNotifyLevelKeys(noti);
  }, [favorites, activeKeySet]);

  const favCount = favoriteLevelKeys.size;
  const notiCount = notifyLevelKeys.size;

  /* =========================
   필터 적용
  ========================= */
  const filteredSessions = useMemo(() => {
    return filterSessions(sessions ?? [], {
      region: selectedRegion ?? undefined,
      level: selectedLevel ?? undefined,
      search: searchQuery || undefined,
    });
  }, [sessions, selectedRegion, selectedLevel, searchQuery]);

  /* =========================
   정렬 (🔔 → ⭐ → 날짜)
  ========================= */
  const sortedSessions = useMemo(() => {
    const getPriority = (s: Session) => {
      const key = `${s.region}|${s.level}`;
      if (notifyLevelKeys.has(key)) return 0;
      if (favoriteLevelKeys.has(key)) return 1;
      return 2;
    };

    return [...filteredSessions]
      .map((s, i) => ({ s, i }))
      .sort((a, b) => {
        const pa = getPriority(a.s);
        const pb = getPriority(b.s);
        if (pa !== pb) return pa - pb;

        const ta = new Date(a.s.start_at).getTime();
        const tb = new Date(b.s.start_at).getTime();
        if (ta !== tb) return ta - tb;

        return a.i - b.i;
      })
      .map((x) => x.s);
  }, [filteredSessions, favoriteLevelKeys, notifyLevelKeys]);

  /* =========================
   ✅ 코치마크: 앱 전체 최초 1회 + 딱 1개 카드에만 붙이기
  ========================= */
  const firstSessionId = sortedSessions[0]?.id;

  useEffect(() => {
    if (!firstSessionId) return;
    if (showCoachmark) return;

    const seen = localStorage.getItem('seen_home_onboarding');
    if (!seen) {
      setCoachmarkSessionId(firstSessionId);
      setShowCoachmark(true);
      setCoachmarkStep(1);
    }
  }, [firstSessionId, showCoachmark]);

  useEffect(() => {
    if (sortedSessions.length === 0) {
      setShowCoachmark(false);
      setCoachmarkSessionId(null);
    }
  }, [sortedSessions.length]);

  /* =========================
   오늘/내일 판정 (✅ KST 기준)
  ========================= */
  const tz = 'Asia/Seoul';
  const ymdKst = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz });
  const todayYmd = ymdKst(new Date());
  const tomorrowYmd = ymdKst(new Date(Date.now() + 86400000));

  const isToday = (s: Session) => ymdKst(new Date(s.start_at)) === todayYmd;
  const isTomorrow = (s: Session) => ymdKst(new Date(s.start_at)) === tomorrowYmd;

  const todayCount = sortedSessions.filter(isToday).length;
  const hasAnyToday = todayCount > 0;

  useEffect(() => {
    if (!hasAnyToday && todayOnly) setTodayOnly(false);
  }, [hasAnyToday, todayOnly]);

  const visibleSessions = todayOnly ? sortedSessions.filter(isToday) : sortedSessions;

  /* =========================
   레벨 단위 그룹화
  ========================= */
  const levelGroups = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of visibleSessions) {
      const key = `${s.region}|${s.level}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }

    Array.from(map.values()).forEach((arr) => {
  arr.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
});

    return Array.from(map.entries());
  }, [visibleSessions]);

  /* =========================
   더보기 상태
  ========================= */
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  /* =========================
   지역 / 레벨 필터칩 (✅ null 제거)
  ========================= */
  const regions = useMemo(() => {
    const list = (sessions ?? [])
      .map((s) => s.region)
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(list));
  }, [sessions]);

  const levels = useMemo(() => {
    const list = (sessions ?? [])
      .map((s) => s.level)
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(list));
  }, [sessions]);

  return (
    <div className={UI.page}>
      <Header
        title="이번 주 강의"
        showSearch
        onSearch={setSearchQuery}
        onClearSearch={() => {
          setSearchQuery('');
          setSelectedRegion(null);
          setSelectedLevel(null);
        }}
        rightActions={
          <>
            {/* 🔔 알림받는 강의 */}
            <button
              type="button"
              onClick={() => router.push('/notifications')}
              className={UI.iconBtn}
              aria-label="알림받는 강의"
            >
              <Bell className="w-5 h-5 text-neutral-700" />
              {notiCount > 0 && <span className={UI.iconBadge}>{notiCount}</span>}
            </button>

            {/* ⭐ 즐겨찾는 강의 */}
            <button
              type="button"
              onClick={() => router.push('/favorites')}
              className={UI.iconBtn}
              aria-label="즐겨찾는 강의"
            >
              <Star className="w-5 h-5 text-neutral-700" />
              {favCount > 0 && <span className={UI.iconBadge}>{favCount}</span>}
            </button>
          </>
        }
      />

      {/* 🔥 오늘 강의 토글 */}
      {hasAnyToday && (
        <div className="px-4 pb-2">
          <button
            type="button"
            onClick={() => setTodayOnly((v) => !v)}
            className={cn(UI.toggleBtn, todayOnly ? UI.toggleOn : UI.toggleOff)}
          >
            <span>🔥 오늘 강의만 보기</span>
            <span className={UI.toggleRight}>
              <span
                className={cn(
                  'text-xs px-2 py-1 rounded-full',
                  todayOnly ? UI.toggleCountOn : UI.toggleCountOff
                )}
              >
                {todayCount}개
              </span>
              <span
                className={cn(
                  'text-xs px-2 py-1 rounded-full',
                  todayOnly ? UI.toggleStateOn : UI.toggleStateOff
                )}
              >
                {todayOnly ? 'ON' : 'OFF'}
              </span>
            </span>
          </button>
        </div>
      )}

      <div className="px-4 pb-3">
        <FilterChips
          regions={regions}
          levels={levels}
          selectedRegion={selectedRegion}
          selectedLevel={selectedLevel}
          onRegionChange={setSelectedRegion}
          onLevelChange={setSelectedLevel}
        />
      </div>

      <main className="px-4 space-y-5">
        {levelGroups.length === 0 ? (
          <EmptyState message="선택한 조건에 맞는 강의가 없어요." />
        ) : (
          levelGroups.map(([groupKey, groupSessions]) => {
            const sample = groupSessions[0];
            const levelKey = `${sample.region}|${sample.level}`;

            const hasTodayInGroup = groupSessions.some(isToday);
            const hasTomorrowInGroup = groupSessions.some(isTomorrow);

            const isExpanded = expandedGroups.has(groupKey);
            const visible = isExpanded ? groupSessions : groupSessions.slice(0, COLLAPSE_LIMIT);
            const restCount = Math.max(0, groupSessions.length - COLLAPSE_LIMIT);

            return (
              <section key={groupKey}>
                <div className={UI.sectionHeaderRow}>
                  <div className={UI.sectionTitle}>
                    {sample.region} · {sample.level}
                  </div>

                  <div className="flex gap-1">
                    {hasTodayInGroup && <span className={cn(UI.pillBase, UI.pillToday)}>⏰ 오늘</span>}
                    {!hasTodayInGroup && hasTomorrowInGroup && (
                      <span className={cn(UI.pillBase, UI.pillTomorrow)}>내일</span>
                    )}
                    {notifyLevelKeys.has(levelKey) && (
                      <span className={cn(UI.pillBase, UI.pillNotify)}>🔔 알림</span>
                    )}
                    {favoriteLevelKeys.has(levelKey) && (
                      <span className={cn(UI.pillBase, UI.pillFav)}>⭐ 즐겨찾기</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {visible.map((session) => {
                    const key = `${session.region}|${session.level}`;

                    return (
                      <SessionCard
                        key={session.id}
                        session={session}
                        isFavorited={favoriteLevelKeys.has(key)}
                        isNotified={notifyLevelKeys.has(key)}
                        onFavoriteClick={() => router.push(`/sessions/${session.id}`)}
                        onNotifyClick={() => router.push(`/sessions/${session.id}`)}
                        showCoachmark={showCoachmark && coachmarkSessionId === session.id}
                        coachmarkStep={coachmarkStep}
                        onDismissCoachmark={() => {
                          if (coachmarkStep === 1) {
                            setCoachmarkStep(2);
                            return;
                          }
                          setShowCoachmark(false);
                          setCoachmarkSessionId(null);
                          localStorage.setItem('seen_home_onboarding', '1');
                        }}
                        hideInstructor
                        hideMaterials
                      />
                    );
                  })}
                </div>

                {restCount > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGroups((prev) => {
                          const next = new Set(prev);
                          isExpanded ? next.delete(groupKey) : next.add(groupKey);
                          return next;
                        })
                      }
                      className={UI.moreBtn}
                    >
                      {isExpanded ? '접기' : `더보기 +${restCount}`}
                    </button>
                  </div>
                )}
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}