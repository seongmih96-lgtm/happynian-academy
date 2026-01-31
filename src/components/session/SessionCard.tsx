'use client';

import { useRouter } from 'next/navigation';
import { MapPin, User, Clock, Package, Calendar, Star, Bell } from 'lucide-react';
import {
  cn,
  formatKoreanDate,
  formatTimeRange,
  getRelativeDate,
  getRegionColor,
  getLevelColor,
  formatMaterials,
} from '@/lib/utils';
import type { Session } from '@/types';

function formatInstructors(items?: Session['instructors']) {
  const list = (items ?? [])
    .filter(Boolean)
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));

  if (!list.length) return '';

  return list
    .map((x) => {
      const n = String(x?.name ?? '').trim();
      if (!n) return '';
      const tag = x?.role === 'sub' ? ' (서브)' : '';
      return `${n}${tag}`;
    })
    .filter(Boolean)
    .join(' · ');
}

interface SessionCardProps {
  session: Session;
  showDate?: boolean;
  compact?: boolean;

    // ✅ 리스트에서만 숨김 옵션
  hideInstructor?: boolean;
  hideMaterials?: boolean;

  // ✅ TODAY 뱃지 표시
  showTodayBadge?: boolean;

  // ⭐ 즐겨찾기
  onFavoriteClick?: () => void;
  isFavorited?: boolean;

  // 🔔 알림
  onNotifyClick?: () => void;
  isNotified?: boolean;

  // ✅ 홈 최초 1회 코치마크
  showCoachmark?: boolean;
  coachmarkStep?: 1 | 2;
  onDismissCoachmark?: () => void;
}

export function SessionCard({
  
    hideInstructor = false,
  hideMaterials = false,
  
  session,
  showDate = true,
  compact = false,
  showTodayBadge = false,

  onFavoriteClick,
  isFavorited = false,

  onNotifyClick,
  isNotified = false,

  showCoachmark = false,
  coachmarkStep = 1,
  onDismissCoachmark,
}: SessionCardProps) {
  const router = useRouter();

  const relativeDate = getRelativeDate(session.start_at);
  const isToday = relativeDate === '오늘';
  const isTomorrow = relativeDate === '내일';
  const isPast = relativeDate === '지난 강의';

  return (
    <div
      onClick={() => router.push(`/sessions/${session.id}`)}
      className={cn(
        'session-card relative',
        isPast && 'opacity-60',
        !compact && 'hover:shadow-card-hover transition-shadow'
      )}
    >
      {/* ✅ 홈 최초 1회 코치마크 (첫 카드에만 showCoachmark=true로 내려옴) */}
      {showCoachmark && (onFavoriteClick || onNotifyClick) && (
        <div
          className="absolute right-3 top-[-6px] z-30"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="relative">
            <div className="rounded-2xl bg-neutral-900 text-white text-xs px-3 py-2 shadow-lg max-w-[220px]">
              <div className="font-semibold mb-1">처음이신가요?</div>

              {coachmarkStep === 1 ? (
                <>⭐ 즐겨찾기를 누르면<br />강의를 모아볼 수 있어요</>
              ) : (
                <>🔔 알림을 켜면<br />강의 전에 알려드려요</>
              )}

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDismissCoachmark?.();
                  }}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px]"
                >
                  확인
                </button>
              </div>
            </div>

            {/* 말풍선 꼬리 */}
            <div className="absolute right-4 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-neutral-900" />
          </div>
        </div>
      )}

      {/* 상단: 지역/레벨 뱃지 + 아이콘 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <span className={cn('badge border', getRegionColor(session.region))}>
            <MapPin className="w-3 h-3" />
            {session.region}
          </span>
          <span className={cn('badge', getLevelColor(session.level))}>{session.level}</span>
          <span className="badge bg-neutral-100 text-neutral-600">{session.session_no}회차</span>
        </div>

        {(onFavoriteClick || onNotifyClick || showTodayBadge) && (
          <div className="flex items-center gap-1">
            {/* ✅ ⏰ TODAY 미니 뱃지 */}
            {showTodayBadge && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-[3px] rounded-full border bg-red-50 text-red-700 border-red-100">
                ⏰ TODAY
              </span>
            )}

            {/* 🔔 알림 */}
            {onNotifyClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onNotifyClick?.();
                }}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  isNotified ? 'text-blue-500 bg-blue-50' : 'text-neutral-300 hover:text-blue-400'
                )}
                title="알림"
              >
                <Bell className={cn('w-5 h-5', isNotified && 'fill-current')} />
              </button>
            )}

            {/* ⭐ 즐겨찾기 */}
            {onFavoriteClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onFavoriteClick?.();
                }}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  isFavorited
                    ? 'text-amber-500 bg-amber-50'
                    : 'text-neutral-300 hover:text-amber-400'
                )}
                title="즐겨찾기"
              >
                <Star className={cn('w-5 h-5', isFavorited && 'fill-current')} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 강의명 */}
      <h3 className={cn('font-semibold text-neutral-900', compact ? 'text-sm' : 'text-base')}>
        {session.title}
      </h3>

      {/* 날짜/시간 */}
      {showDate && (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-neutral-400" />
          <span
            className={cn(
              isToday && 'text-primary-600 font-medium',
              isTomorrow && 'text-secondary-600 font-medium',
              isPast && 'text-neutral-400'
            )}
          >
            {relativeDate !== '지난 강의' &&
            relativeDate !== formatKoreanDate(session.start_at, 'M월 d일')
              ? `${relativeDate} · `
              : ''}
            {formatKoreanDate(session.start_at, 'M월 d일 (E)')}
          </span>

          <Clock className="w-4 h-4 text-neutral-400 ml-2" />
          <span className="text-neutral-600">
            {formatTimeRange(session.start_at, session.end_at)}
          </span>
        </div>
      )}

            {/* 강사 (리스트에서 숨김 가능) */}
      {!hideInstructor &&
        (() => {
          const display =
            formatInstructors((session as any).instructors) ||
            (session.instructor ? String(session.instructor) : '');

          if (!display) return null;

          return (
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <User className="w-4 h-4 text-neutral-400" />
              <span>{display}</span>
            </div>
          );
        })()}

            {/* 준비물 (리스트에서 숨김 가능) */}
      {!hideMaterials && session.materials && session.materials.length > 0 && !compact && (
        <div className="flex items-start gap-2 text-sm text-neutral-600">
          <Package className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{formatMaterials(session.materials)}</span>
        </div>
      )}
    </div>
  );
}