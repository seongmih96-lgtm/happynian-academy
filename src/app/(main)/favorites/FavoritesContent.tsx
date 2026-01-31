'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Header } from '@/components/layout/Header';
import { FilterChips } from '@/components/ui/FilterChips';
import { SessionCard } from '@/components/session/SessionCard';
import { EmptyState } from '@/components/ui/EmptyState';

import type { Session, Profile, Favorite } from '@/types';
import { filterSessions } from '@/lib/utils';

type FavoritesProfile = Pick<Profile, 'status' | 'role' | 'region' | 'level'>;

interface Props {
  profile: FavoritesProfile | null;
  favorites: Favorite[];
  sessions: Session[];
  hiddenCount?: number;
  activeLevelKeys?: string[];
}

export default function FavoritesContent({
  profile,
  favorites,
  sessions,
  hiddenCount = 0,
}: Props) {
  const router = useRouter();

  /* ================== 첫 진입 가이드 ================== */
  const [showFirstGuide, setShowFirstGuide] = useState(false);

  useEffect(() => {
    // ✅ 현재 유효한 즐겨찾기가 0개일 때만 가이드 노출
    const hasAnyFavorite = (favorites ?? []).length > 0;
    const seen = localStorage.getItem('seen_favorites_guide');

    if (!hasAnyFavorite && !seen) setShowFirstGuide(true);
  }, [favorites]);

  /* ================== 필터 상태 ================== */
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  /* ================== 즐겨찾기 키 ================== */
  const favoriteLevelKeys = useMemo(() => {
    return new Set((favorites ?? []).map((f) => `${f.region}|${f.level}`));
  }, [favorites]);

  /* ================== 즐겨찾기 세션 ================== */
  const favoriteSessions = useMemo(() => {
    return (sessions ?? []).filter((s) => favoriteLevelKeys.has(`${s.region}|${s.level}`));
  }, [sessions, favoriteLevelKeys]);

  /* ================== 필터 옵션 ================== */
  const regions = useMemo(() => {
    return Array.from(new Set((favoriteSessions ?? []).map((s) => s.region).filter(Boolean)));
  }, [favoriteSessions]);

  const levels = useMemo(() => {
    return Array.from(new Set((favoriteSessions ?? []).map((s) => s.level).filter(Boolean)));
  }, [favoriteSessions]);

  /* ================== 필터 적용 ================== */
  const filtered = useMemo(() => {
    return filterSessions(favoriteSessions ?? [], {
      region: selectedRegion ?? undefined,
      level: selectedLevel ?? undefined,
      search: searchQuery || undefined,
    });
  }, [favoriteSessions, selectedRegion, selectedLevel, searchQuery]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <button
        type="button"
        onClick={() => router.back()}
        className="mx-4 mt-3 mb-1 text-sm text-neutral-600"
      >
        ← 뒤로
      </button>

      <Header title="즐겨찾는 강의" showSearch onSearch={setSearchQuery} />

      {/* ✅ 삭제된 강의 자동 숨김 안내 */}
      {hiddenCount > 0 && (
        <div className="mx-4 mt-3 mb-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          예전에 즐겨찾기 해둔 강의 중 <b>{hiddenCount}개</b>가 삭제되어 목록에서 자동으로 제외했어요.
        </div>
      )}

      {/* ✅ 첫 진입 가이드 */}
      {showFirstGuide && (
        <div className="mx-4 mt-3 mb-3 rounded-2xl border bg-white p-4">
          <div className="text-sm font-semibold">⭐ 즐겨찾기 이렇게 시작해요</div>
          <div className="mt-1 text-sm text-neutral-600">
            강의 상세에서 ⭐를 누르면 같은 지역·레벨 강의가 모여요.
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => router.push('/home')}
              className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm"
            >
              홈에서 강의 찾기
            </button>

            <button
              type="button"
              onClick={() => {
                localStorage.setItem('seen_favorites_guide', '1');
                setShowFirstGuide(false);
              }}
              className="px-4 py-2 rounded-xl border text-sm"
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
          <EmptyState message="아직 즐겨찾는 강의가 없어요.">
            <div className="mt-4 flex flex-col gap-2 items-center">
              <button
                type="button"
                onClick={() => router.push('/home')}
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm"
              >
                홈에서 강의 찾기
              </button>

              <button
                type="button"
                onClick={() => router.push('/notifications')}
                className="px-4 py-2 rounded-xl border text-sm"
              >
                🔔 알림받는 강의 보기
              </button>

              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('seen_favorites_guide');
                  setShowFirstGuide(true);
                }}
                className="px-4 py-2 rounded-xl border text-sm"
              >
                ⭐ 즐겨찾기 안내 다시보기
              </button>
            </div>
          </EmptyState>
        ) : (
          filtered.map((session) => {
            const key = `${session.region}|${session.level}`;
            return (
              <SessionCard
                key={session.id}
                session={session}
                isFavorited={favoriteLevelKeys.has(key)}
                onFavoriteClick={() => router.push(`/sessions/${session.id}`)}
                onNotifyClick={() => router.push(`/sessions/${session.id}`)}
              />
            );
          })
        )}
      </main>
    </div>
  );
}