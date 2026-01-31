'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Header } from '@/components/layout/Header';
import { FilterChips } from '@/components/ui/FilterChips';
import { SessionCard } from '@/components/session/SessionCard';

import { ChevronLeft, ChevronRight, Grid3X3, List } from 'lucide-react';
import { filterSessions, groupSessionsByDate, formatKoreanDate, cn } from '@/lib/utils';

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { ko } from 'date-fns/locale';

import type { Session, Favorite } from '@/types';

type ViewMode = 'month' | 'week';

interface CalendarContentProps {
  sessions: Session[];
  favorites: Favorite[];
}

const TZ = 'Asia/Seoul';
const WEEK_VISIBLE_LIMIT = 6;

// ✅ KST 기준 yyyy-mm-dd
function ymdKst(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

// ✅ KST 기준 월요일 시작 주간 start(라벨용)
function startOfWeekMonKst(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ✅ ISO를 "KST 기준 Date"로 변환 (주간 날짜 필터 정확도용)
function toKstDate(iso: string) {
  return new Date(new Date(iso).toLocaleString('en-US', { timeZone: TZ }));
}

// ✅ 주간 작은 카드(리스트)에서도 메인+서브 강사 표시
function formatInstructorLine(s: any) {
  const list = Array.isArray(s?.instructors) ? s.instructors : [];

  if (list.length > 0) {
    const sorted = [...list].sort(
      (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
    );

    const main =
      sorted.find((x) => x?.role === 'main')?.name ??
      sorted[0]?.name ??
      null;

    const subs = sorted
      .filter((x) => x?.role === 'sub')
      .map((x) => x?.name)
      .filter(Boolean);

    if (main && subs.length > 0) return `강사: ${main} (서브: ${subs.join(', ')})`;
    if (main) return `강사: ${main}`;
  }

  // fallback: legacy 단일 컬럼
  if (s?.instructor) return `강사: ${s.instructor}`;
  return '강사 미지정';
}

export function CalendarContent({ sessions, favorites }: CalendarContentProps) {
  const router = useRouter();

  // ✅ month 기준 anchor
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // ✅ week 기준 anchor (주간 단위 이동용)
  const [weekAnchor, setWeekAnchor] = useState(new Date());

  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // ✅ month 상세 리스트
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // ✅ week 상세 리스트(선택된 ymd)
  const [weekSelectedYmd, setWeekSelectedYmd] = useState<string | null>(null);

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  const detailRef = useRef<HTMLDivElement | null>(null);

  const favoriteKeys = useMemo(
    () => new Set((favorites ?? []).map((f) => `${f.region}-${f.level}`)),
    [favorites]
  );

  // FilterChips 옵션
  const regions = useMemo(() => {
    const list = (sessions ?? []).map((s) => s.region).filter((v): v is string => Boolean(v));
    return Array.from(new Set(list));
  }, [sessions]);

  const levels = useMemo(() => {
    const list = (sessions ?? []).map((s) => s.level).filter((v): v is string => Boolean(v));
    return Array.from(new Set(list));
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return filterSessions(sessions ?? [], {
      region: selectedRegion || undefined,
      level: selectedLevel || undefined,
    });
  }, [sessions, selectedRegion, selectedLevel]);

  const sessionsByDate = useMemo(() => groupSessionsByDate(filteredSessions), [filteredSessions]);

  // ✅ 월간 달력 칸
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // ✅ 월간: 선택 날짜 세션
  const selectedDateSessions = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return sessionsByDate.get(key) || [];
  }, [selectedDate, sessionsByDate]);

  // =========================
  // ✅ 상단 < > 이동 로직
  // - month: 월 단위
  // - week: 주 단위
  // =========================
  const goPrev = () => {
    if (viewMode === 'week') {
      const next = subWeeks(weekAnchor, 1);
      setWeekAnchor(next);
      // 선택된 날짜가 있으면, 같은 요일 유지가 자연스러움:
      if (weekSelectedYmd) {
        const d = new Date(`${weekSelectedYmd}T00:00:00+09:00`);
        const moved = subWeeks(d, 1);
        setWeekSelectedYmd(ymdKst(moved));
      }
    } else {
      setCurrentMonth(subMonths(currentMonth, 1));
    }
  };

  const goNext = () => {
    if (viewMode === 'week') {
      const next = addWeeks(weekAnchor, 1);
      setWeekAnchor(next);
      if (weekSelectedYmd) {
        const d = new Date(`${weekSelectedYmd}T00:00:00+09:00`);
        const moved = addWeeks(d, 1);
        setWeekSelectedYmd(ymdKst(moved));
      }
    } else {
      setCurrentMonth(addMonths(currentMonth, 1));
    }
  };

  // =========================
  // ✅ 주간: 7일 생성
  // =========================
  const weekDays = useMemo(() => {
    const start = startOfWeekMonKst(weekAnchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekAnchor]);

  // ✅ 주간: 범위 라벨
  const weekRangeLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    return `${format(start, 'M월 d일', { locale: ko })} ~ ${format(end, 'M월 d일', { locale: ko })}`;
  }, [weekDays]);

  // ✅ 주간: weekDays 범위 안의 세션만 (KST ymd 기준)  ← (수정됨)
  const weekSessions = useMemo(() => {
    const keys = new Set(weekDays.map((d) => ymdKst(d)));
    return (filteredSessions ?? []).filter((s) => {
      const d = toKstDate(s.start_at);
      return keys.has(ymdKst(d));
    });
  }, [filteredSessions, weekDays]);

  // ✅ 주간: 날짜별 묶기  ← (수정됨)
  const weekByDay = useMemo(() => {
    const m: Record<string, Session[]> = {};
    weekDays.forEach((d) => (m[ymdKst(d)] = []));

    (weekSessions ?? []).forEach((s) => {
      const d = toKstDate(s.start_at);
      const key = ymdKst(d);
      if (!m[key]) m[key] = [];
      m[key].push(s);
    });

    Object.keys(m).forEach((k) => {
      m[k].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    });

    return m;
  }, [weekSessions, weekDays]);

  // ✅ 주간: 아래 상세 리스트(선택된 ymd)
  const weekDetailSessions = useMemo(() => {
    if (!weekSelectedYmd) return [];
    return weekByDay[weekSelectedYmd] ?? [];
  }, [weekSelectedYmd, weekByDay]);

  // ✅ 주간: “전체 보기” or 날짜 클릭 시 자동 스크롤
  useEffect(() => {
    if (!weekSelectedYmd) return;
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [weekSelectedYmd]);

  // =========================
  // ✅ 주간: 선택 날짜 클릭 동작
  // =========================
  const onPickWeekDay = (key: string) => {
    setWeekSelectedYmd((prev) => (prev === key ? null : key));
  };

  return (
    <>
      <Header title="캘린더" />

      {/* 상단: 이동 + 월간/주간 토글 */}
      <div className="px-4 py-3 bg-white border-b border-neutral-100">
        <div className="flex items-center justify-between mb-3">
          <button onClick={goPrev} className="p-2 rounded-lg hover:bg-neutral-100" type="button">
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <div className="text-lg font-bold text-neutral-900">
              {format(currentMonth, 'yyyy년 M월', { locale: ko })}
            </div>
            {viewMode === 'week' && <div className="mt-1 text-xs text-neutral-500">{weekRangeLabel}</div>}
          </div>

          <button onClick={goNext} className="p-2 rounded-lg hover:bg-neutral-100" type="button">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setViewMode('month');
              setWeekSelectedYmd(null);
            }}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              viewMode === 'month' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
            )}
          >
            <Grid3X3 className="w-4 h-4 inline mr-1" />
            월간
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode('week');
              setSelectedDate(null);
              setWeekAnchor(new Date());
              setWeekSelectedYmd(null);
            }}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              viewMode === 'week' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
            )}
          >
            <List className="w-4 h-4 inline mr-1" />
            주간
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="px-4 py-3 bg-white border-b border-neutral-100">
        <FilterChips
          regions={regions}
          levels={levels}
          selectedRegion={selectedRegion}
          selectedLevel={selectedLevel}
          onRegionChange={setSelectedRegion}
          onLevelChange={setSelectedLevel}
        />
      </div>

      <main className="px-4 py-4">
        {/* =========================
            월간
           ========================= */}
        {viewMode === 'month' ? (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-card mb-4">
              {/* 요일 */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                  <div
                    key={day}
                    className={cn(
                      'text-center text-xs font-medium py-2',
                      i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-neutral-500'
                    )}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const daySessions = sessionsByDate.get(dateKey) || [];
                  const isCurrent = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const today = isToday(day);

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedDate(isSelected ? null : day)}
                      className={cn(
                        'aspect-square p-1 rounded-lg transition-all relative',
                        !isCurrent && 'opacity-30',
                        isSelected && 'bg-neutral-900 text-white',
                        !isSelected && today && 'bg-neutral-100',
                        !isSelected && daySessions.length > 0 && 'hover:bg-neutral-100'
                      )}
                    >
                      <span className={cn('text-sm font-medium', isSelected && 'text-white', !isSelected && today && 'text-neutral-900')}>
                        {format(day, 'd')}
                      </span>

                      {daySessions.length > 0 && !isSelected && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {daySessions.slice(0, 3).map((_, i) => (
                            <div key={i} className="w-1 h-1 rounded-full bg-neutral-900" />
                          ))}
                        </div>
                      )}
                    </button> 
                  );
                })}
              </div>
            </div>

            {/* 선택 날짜 상세 */}
            {selectedDate ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-neutral-600">
                  {formatKoreanDate(format(selectedDate, "yyyy-MM-dd'T'00:00:00+09:00"), 'M월 d일 (E)')} 강의
                </h3>

                {selectedDateSessions.length === 0 ? (
                  <div className="text-center py-8 text-neutral-400 text-sm">이 날에 예정된 강의가 없습니다</div>
                ) : (
                  selectedDateSessions.map((session) => (
                    <SessionCard
  key={session.id}
  session={session}
  showDate={true}
  isFavorited={favoriteKeys.has(`${session.region}-${session.level}`)}
  onFavoriteClick={() => router.push(`/sessions/${session.id}`)}
  onNotifyClick={() => router.push(`/sessions/${session.id}`)}
  hideInstructor
  hideMaterials
/>
                  ))
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-neutral-400 text-sm">날짜를 선택하면 해당 날짜의 강의를 볼 수 있습니다</div>
            )}
          </>
        ) : (
          /* =========================
             주간
           ========================= */
          <>
            <div className="bg-white rounded-2xl p-3 shadow-card">
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((d) => {
                  const key = ymdKst(d);
                  const list = weekByDay[key] ?? [];

                  const isTodayCol = key === ymdKst(new Date());
                  const isSelected = weekSelectedYmd === key;

                  return (
                    <div
                      key={key}
                      className={cn(
                        'rounded-2xl border p-2 transition',
                        isTodayCol ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 bg-white',
                        isSelected ? 'ring-2 ring-neutral-900/20' : ''
                      )}
                    >
                      {/* 날짜 헤더 */}
                      <button type="button" onClick={() => onPickWeekDay(key)} className="w-full text-left">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] text-neutral-500">
                            {d.toLocaleDateString('ko-KR', { weekday: 'short' })}
                          </div>

                          {isSelected && (
                            <span className="text-[10px] px-2 py-[2px] rounded-full bg-neutral-900 text-white">
                              선택됨
                            </span>
                          )}
                        </div>

                        <div className={cn('text-sm font-semibold mt-0.5', isTodayCol ? 'text-neutral-900' : 'text-neutral-800')}>
                          {d.getDate()}
                        </div>
                      </button>

                      {/* ✅ 카드 영역: 세션 많으면 내부 스크롤 */}
                      <div className="mt-2 space-y-1 max-h-[220px] overflow-auto pr-1">
                        {list.length === 0 ? (
                          <div className="text-[11px] text-neutral-300">—</div>
                        ) : (
                          list.slice(0, WEEK_VISIBLE_LIMIT).map((s: any) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => router.push(`/sessions/${s.id}`)}
                              className="w-full text-left rounded-lg border border-neutral-100 bg-white px-2 py-1 hover:bg-neutral-100 transition"
                              title={s.title ?? ''}
                            >
                              {/* 시간 */}
                              <div className="text-[11px] text-neutral-500">{timeLabel(s.start_at)}</div>

                              {/* 지역/레벨/회차 */}
                              <div className="mt-0.5 text-[11px] text-neutral-600 truncate">
                                {(s.region ?? '지역미정')} · {(s.level ?? '레벨미정')}
                                {s.session_no != null ? ` · 회차 ${s.session_no}` : ''}
                              </div>

                              {/* 강의명 */}
                              <div className="mt-0.5 text-[12px] font-semibold text-neutral-900 truncate">
                                {s.title ?? '제목 없음'}
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      {/* ✅ UX 개선: +N개 더 -> "전체 보기" */}
                      {list.length > WEEK_VISIBLE_LIMIT && (
                        <button
                          type="button"
                          onClick={() => setWeekSelectedYmd(key)}
                          className="mt-2 w-full text-[11px] rounded-xl border border-neutral-200 bg-white py-2 text-neutral-700 hover:bg-neutral-50"
                        >
                          전체 보기 ({list.length}개)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 아래 상세(전체 표시) + 자동 스크롤 타겟 */}
            <div ref={detailRef} className="mt-4">
              {weekSelectedYmd ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-neutral-900">
                      {formatKoreanDate(`${weekSelectedYmd}T00:00:00+09:00`, 'M월 d일 (E)')} 강의 전체
                    </div>

                    <button
                      type="button"
                      onClick={() => setWeekSelectedYmd(null)}
                      className="text-xs px-3 py-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50"
                    >
                      닫기
                    </button>
                  </div>

                  {weekDetailSessions.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400 text-sm">이 날에 예정된 강의가 없습니다</div>
                  ) : (
                    <div className="space-y-2">
                      {weekDetailSessions.map((session) => (
                        <SessionCard
  key={session.id}
  session={session}
  showDate={true}
  isFavorited={favoriteKeys.has(`${session.region}-${session.level}`)}
  onFavoriteClick={() => router.push(`/sessions/${session.id}`)}
  onNotifyClick={() => router.push(`/sessions/${session.id}`)}
  hideInstructor
  hideMaterials
/>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-neutral-400 text-sm">
                  위에서 날짜를 선택하면 그 날짜의 강의를 자세히 볼 수 있어요.
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}