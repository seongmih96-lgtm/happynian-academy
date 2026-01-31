import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isWithinInterval,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { WEEKDAY_LABELS, REGION_COLORS, LEVEL_COLORS } from './constants';
import type { Session, SessionFilter, SessionInstructorItem } from '@/types';

// 한국 시간대
const KST = 'Asia/Seoul';

/**
 * ISO 문자열을 KST Date 객체로 변환
 * - 잘못된/없는 값이면 null 반환
 */
export function toKST(dateString?: string | null): Date | null {
  if (!dateString) return null;
  try {
    return toZonedTime(parseISO(dateString), KST);
  } catch {
    return null;
  }
}

/**
 * 날짜를 한국어 형식으로 포맷 (예: 1월 20일 (월))
 */
export function formatKoreanDate(dateString?: string | null, fmt: string = 'M월 d일 (E)') {
  const d = toKST(dateString);
  if (!d) return '';
  return format(d, fmt, { locale: ko });
}

/**
 * 시간만 포맷 (예: 14:00)
 */
export function formatTime(dateString?: string | null): string {
  if (!dateString) return '';
  try {
    return formatInTimeZone(parseISO(dateString), KST, 'HH:mm');
  } catch {
    return '';
  }
}

/**
 * 시간 범위 포맷 (예: 14:00 - 17:00)
 * ✅ 기존 중복 함수 제거하고 이걸로 통일
 */
export function formatTimeRange(startAt?: string | null, endAt?: string | null): string {
  const s = formatTime(startAt);
  const e = formatTime(endAt);
  if (!s || !e) return '';
  return `${s} - ${e}`;
}

/**
 * 상대적 날짜 표시 (오늘, 내일, D-N)
 */
export function getRelativeDate(dateString?: string | null): string {
  const targetDate = toKST(dateString);
  if (!targetDate) return '';

  const today = new Date();

  if (isSameDay(today, targetDate)) return '오늘';

  const tomorrow = addDays(today, 1);
  if (isSameDay(tomorrow, targetDate)) return '내일';

  const diffDays = Math.ceil(
    (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays > 0 && diffDays <= 7) return `D-${diffDays}`;
  if (diffDays < 0) return '지난 강의';

  return formatKoreanDate(dateString);
}

/**
 * 이번 주 범위 가져오기 (월요일 시작)
 */
export function getThisWeekRange() {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  return { weekStart, weekEnd };
}

/**
 * 세션이 특정 주에 속하는지 확인
 */
export function isSessionInWeek(session: Session, weekStart: Date, weekEnd: Date): boolean {
  const sessionDate = toKST((session as any)?.start_at);
  if (!sessionDate) return false;
  return isWithinInterval(sessionDate, { start: weekStart, end: weekEnd });
}

/**
 * 세션을 날짜별로 그룹화
 */
export function groupSessionsByDate(sessions: Session[]): Map<string, Session[]> {
  const grouped = new Map<string, Session[]>();

  sessions.forEach((session) => {
    const d = toKST((session as any)?.start_at);
    if (!d) return;

    const dateKey = format(d, 'yyyy-MM-dd');
    const existing = grouped.get(dateKey) || [];
    grouped.set(dateKey, [...existing, session]);
  });

  return grouped;
}

/**
 * 세션을 지역별로 그룹화
 */
export function groupSessionsByRegion(sessions: Session[]): Map<string, Session[]> {
  const grouped = new Map<string, Session[]>();

  sessions.forEach((session: any) => {
    const region = session?.region ?? '미지정';
    const existing = grouped.get(region) || [];
    grouped.set(region, [...existing, session]);
  });

  return grouped;
}

/**
 * 세션 필터링
 */
export function filterSessions(sessions: Session[], filter: SessionFilter): Session[] {
  return sessions.filter((session: any) => {
    if (filter.region && session.region !== filter.region) return false;
    if (filter.level && session.level !== filter.level) return false;

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const matchesTitle = (session.title ?? '').toLowerCase().includes(searchLower);
      const instructorText =
  (session.instructor ?? '') +
  ' ' +
  ((session.instructors ?? [])
    .map((x: any) => x?.name ?? '')
    .join(' '));

const matchesInstructor = instructorText.toLowerCase().includes(searchLower);

      const matchesRegion = (session.region ?? '').toLowerCase().includes(searchLower);
      if (!matchesTitle && !matchesInstructor && !matchesRegion) return false;
    }

    if (filter.startDate) {
      const sessionDate = toKST(session.start_at);
      if (!sessionDate) return false;

      const filterStart = parseISO(filter.startDate);
      if (sessionDate < filterStart) return false;
    }

    if (filter.endDate) {
      const sessionDate = toKST(session.start_at);
      if (!sessionDate) return false;

      const filterEnd = parseISO(filter.endDate);
      if (sessionDate > filterEnd) return false;
    }

    return true;
  });
}

/**
 * 준비물 배열을 문자열로 변환
 */
export function formatMaterials(materials?: unknown): string {
  if (materials == null) return '없음';

  // ✅ DB가 text로 바뀐 경우
  if (typeof materials === 'string') {
    const t = materials.trim();
    return t === '' ? '없음' : t;
  }

  // ✅ 혹시 예전 데이터가 배열로 남아있거나, 다시 jsonb로 바꿀 수도 있으니 안전하게
  if (Array.isArray(materials)) {
    const list = materials
      .map((x) => (x == null ? '' : String(x).trim()))
      .filter((x) => x !== '');
    return list.length ? list.join(', ') : '없음';
  }

  // ✅ 그 외(객체 등) - 문자열로라도 보여주기
  try {
    const t = String(materials).trim();
    return t === '' ? '없음' : t;
  } catch {
    return '없음';
  }
}

/**
 * 지역 색상 클래스 가져오기
 */
export function getRegionColor(region?: string | null): string {
  if (!region) return 'bg-gray-100 text-gray-700 border-gray-200';
  return REGION_COLORS[region] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * 레벨 색상 클래스 가져오기
 */
export function getLevelColor(level?: string | null): string {
  if (!level) return 'bg-gray-100 text-gray-700';
  return LEVEL_COLORS[level] || 'bg-gray-100 text-gray-700';
}

/**
 * 강의 시간 계산 (분 단위)
 */
export function getSessionDurationMinutes(startAt?: string | null, endAt?: string | null): number {
  if (!startAt || !endAt) return 0;
  try {
    const start = parseISO(startAt);
    const end = parseISO(endAt);
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));
  } catch {
    return 0;
  }
}

/**
 * 강의 시간 포맷 (예: 3시간)
 */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0분';
  if (minutes < 60) return `${minutes}분`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

/**
 * 클래스명 조합 헬퍼
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * 디바운스 함수
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 숫자를 원화 형식으로 포맷
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount);
}

/**
 * 진행률 퍼센트 표시
 */
export function formatProgress(percent: number): string {
  return `${Math.round(percent)}%`;
}

/**
 * 영상 시간 포맷 (초 → MM:SS 또는 HH:MM:SS)
 */
export function formatVideoDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * 빈 값 체크
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value as any).length === 0) return true;
  return false;
}

export function formatInstructors(items?: SessionInstructorItem[] | null) {
  const list = (items ?? [])
    .filter(Boolean)
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));

  if (!list.length) return '';

  return list
    .map((x) => {
      const n = String(x.name ?? '').trim();
      if (!n) return '';
      const tag = x.role === 'sub' ? ' (서브)' : '';
      return `${n}${tag}`;
    })
    .filter(Boolean)
    .join(' · ');
}