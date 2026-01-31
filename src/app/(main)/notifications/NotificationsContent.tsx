'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Header } from '@/components/layout/Header';
import { FilterChips } from '@/components/ui/FilterChips';
import { SessionCard } from '@/components/session/SessionCard';
import { EmptyState } from '@/components/ui/EmptyState';

import type { Session, Profile, Favorite } from '@/types';
import { filterSessions } from '@/lib/utils';

interface Props {
  profile: Profile | null;
  favorites: Favorite[];          // ✅ 서버에서 "유효한(삭제된 강의 제외)" 알림만 내려옴
  sessions: Session[];            // ✅ 전체 세션(전체기간)
  hiddenCount?: number;           // ✅ 삭제된 강의로 인해 숨긴 알림 수
  activeLevelKeys?: string[];     // ✅ 필요하면 추후 사용
}

export default function NotificationsContent({
  profile,
  favorites,
  sessions,
  hiddenCount = 0,
}: Props) {
  const router = useRouter();

  // ✅ 첫 진입 가이드(한 번만)
  const [showFirstGuide, setShowFirstGuide] = useState(false);

  useEffect(() => {
    // ✅ 현재 유효한 알림이 0개일 때만 가이드 노출
    const hasAnyNotify = (favorites ?? []).length > 0;
    const seen = localStorage.getItem('seen_notifications_guide');

    if (!hasAnyNotify && !seen) setShowFirstGuide(true);
  }, [favorites]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  // ✅ 알림 레벨 키들
  const notifyLevelKeys = useMemo(() => {
    return new Set((favorites ?? []).map((f: any) => `${f.region}|${f.level}`));
  }, [favorites]);

  // ✅ 알림 켠 레벨에 속하는 세션만 추리기
  const notifySessions = useMemo(() => {
    return (sessions ?? []).filter((s: any) => notifyLevelKeys.has(`${s.region}|${s.level}`));
  }, [sessions, notifyLevelKeys]);

  // ✅ 지역/레벨 목록(알림 세션 기준)
  const regions = useMemo(() => {
    return Array.from(
      new Set(
        (notifySessions ?? [])
          .map((s: any) => s.region)
          .filter((v: any): v is string => Boolean(v))
      )
    );
  }, [notifySessions]);

  const levels = useMemo(() => {
    return Array.from(
      new Set(
        (notifySessions ?? [])
          .map((s: any) => s.level)
          .filter((v: any): v is string => Boolean(v))
      )
    );
  }, [notifySessions]);

  // ✅ 필터 적용
  const filtered = useMemo(() => {
    return filterSessions(notifySessions ?? [], {
      region: selectedRegion ?? undefined,
      level: selectedLevel ?? undefined,
      search: searchQuery || undefined,
    });
  }, [notifySessions, selectedRegion, selectedLevel, searchQuery]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <button
        type="button"
        onClick={() => router.back()}
        className="mx-4 mt-3 mb-1 text-sm text-neutral-600"
      >
        ← 뒤로
      </button>

      <Header
        title="알림받는 강의"
        showSearch
        onSearch={setSearchQuery}
        rightActions={
          <>
            <button
              type="button"
              onClick={() => router.push('/notifications')}
              className="p-2 rounded-xl hover:bg-neutral-100"
              aria-label="알림받는 강의"
              title="알림"
            >
              🔔
            </button>

            <button
              type="button"
              onClick={() => router.push('/favorites')}
              className="p-2 rounded-xl hover:bg-neutral-100"
              aria-label="즐겨찾는 강의"
              title="즐겨찾기"
            >
              ⭐
            </button>
          </>
        }
      />

      {/* ✅ 삭제된 강의 자동 숨김 안내 */}
      {hiddenCount > 0 && (
        <div className="mx-4 mt-3 mb-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          예전에 알림 켜둔 강의 중 <b>{hiddenCount}개</b>가 삭제되어 목록에서 자동으로 제외했어요.
        </div>
      )}

      {/* ✅ Header 아래에 첫 진입 가이드 */}
      {showFirstGuide && (
        <div className="mx-4 mt-3 mb-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-semibold text-neutral-900">🔔 알림 이렇게 받아요</div>

          <div className="mt-1 text-sm text-neutral-600">
            강의 상세에서 <b>🔔</b>를 누르면 같은 <b>지역·레벨</b> 강의 시작 전에 알려드려요.
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => router.push('/home')}
              className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm hover:opacity-90"
            >
              홈에서 강의 둘러보기
            </button>

            <button
              type="button"
              onClick={() => {
                localStorage.setItem('seen_notifications_guide', '1');
                setShowFirstGuide(false);
              }}
              className="px-4 py-2 rounded-xl bg-white border border-neutral-200 text-sm hover:bg-neutral-50"
            >
              다음에 볼게요
            </button>
          </div>
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

      <main className="px-4 space-y-2">
        {filtered.length === 0 ? (
          <EmptyState message="아직 알림받는 강의가 없어요. 강의 상세에서 🔔를 눌러 설정해보세요!">
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => router.push('/home')}
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm hover:opacity-90"
              >
                홈에서 강의 찾기
              </button>

              <button
                type="button"
                onClick={() => router.push('/favorites')}
                className="px-4 py-2 rounded-xl bg-white border border-neutral-200 text-sm hover:bg-neutral-50"
              >
                ⭐ 즐겨찾는 강의 보기
              </button>

              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('seen_notifications_guide');
                  setShowFirstGuide(true);
                }}
                className="px-4 py-2 rounded-xl bg-white border border-neutral-200 text-sm hover:bg-neutral-50"
              >
                🔔 알림 안내 다시보기
              </button>
            </div>
          </EmptyState>
        ) : (
          filtered.map((session: any) => {
            const key = `${session.region}|${session.level}`;

            return (
              <SessionCard
                key={session.id}
                session={session}
                isNotified={notifyLevelKeys.has(key)}
                onNotifyClick={() => router.push(`/sessions/${session.id}`)}
              />
            );
          })
        )}
      </main>
    </div>
  );
}