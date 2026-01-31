'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Star, CreditCard, PlayCircle,
  LogOut, ChevronRight, Check, X, Loader2, Settings, Bell
} from 'lucide-react';
import { cn, formatCurrency, getRegionColor } from '@/lib/utils';
import { USER_ROLE_LABELS, USER_STATUS_LABELS } from '@/lib/constants';
import { supabase } from '@/lib/supabase/client';
import type { Profile, Favorite, Payment, VideoProgress } from '@/types';
import AdminUserSearchSection from './_components/AdminUserSearchSection';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { UserSearchAdmin } from './UserSearchAdmin';

type MyLectureReg = {
  id: string;
  user_id: string;
  region: string;
  level: string;
  created_at: string;
};

type WatchItem = {
  id: string;
  user_id: string;
  created_at: string;
  resource_id?: string | null;
  session_id?: string | null;
  enabled?: boolean | null;
};

type MentorType = 'book' | 'youtube' | 'movie';
type MentorSortMode = 'latest' | 'recommended';

type MentorItem = {
  id: string;
  type: MentorType;
  title: string;
  creator: string | null;
  url: string | null;
  note: string | null;
  sort_index: number;
  created_at: string;
};

type MentorFlag = {
  user_id: string;
  item_id: string;
  liked: boolean;
  completed: boolean;
  updated_at: string;
};

type MentorLikeCountRow = {
  item_id: string;
  like_count: number;
};

interface ProfileContentProps {
  profile: Profile;
  favorites: Favorite[];
  payments: Payment[];
  videoProgress: VideoProgress[];
  myLectureRegs: MyLectureReg[];
}

export function ProfileContent({
  profile,
  favorites,
  payments,
  videoProgress,
  myLectureRegs,
}: ProfileContentProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [openUserSearch, setOpenUserSearch] = useState(false);

  // =========================
  // 스승을 만나다 상태
  // =========================
  const [mentorTab, setMentorTab] = useState<MentorType>('book');
  const [mentorSort, setMentorSort] = useState<MentorSortMode>('latest'); // ✅ 최신순 기본
  const [mentorMineOnly, setMentorMineOnly] = useState(false); // ✅ 내가 찜한것만 보기
  const [mentorLoading, setMentorLoading] = useState(false);

  const [mentorItems, setMentorItems] = useState<MentorItem[]>([]);
  const [mentorFlags, setMentorFlags] = useState<Record<string, MentorFlag>>({});
  const [mentorLikeCounts, setMentorLikeCounts] = useState<Record<string, number>>({});

  // =========================
  // 통계
  // =========================
  const videoStats = {
    total: videoProgress.length,
    completed: videoProgress.filter((p) => p.progress_percent >= 100).length,
    inProgress: videoProgress.filter((p) => p.progress_percent > 0 && p.progress_percent < 100).length,
  };

  const paymentStats = {
    total: payments.length,
    paid: payments.filter((p) => p.paid).length,
    unpaid: payments.filter((p) => !p.paid).length,
    totalPaid: payments.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0),
  };

  const watchStats = {
  total: favorites.filter((f) => f.notify_enabled).length,
  enabled: favorites.filter((f) => f.notify_enabled).length,
};

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/signout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  };

  // =========================
  // ✅ 스승을 만나다: 로드
  // - 안전하게: items / flags / like_counts를 각각 가져온 뒤
  //   프론트에서 필터+정렬(추천/최신)을 수행
  // - “내가 찜한것만 보기 ON”이어도 정렬 유지됨
  // =========================
  const loadMentor = async () => {
    try {
      setMentorLoading(true);

      const { data: userRes, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const user = userRes?.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      // 1) 해당 탭 타입 전체 아이템 로드
      const { data: items, error: iErr } = await supabase
        .from('mentor_items')
        .select('id,type,title,creator,url,note,sort_index,created_at')
        .eq('type', mentorTab);
      if (iErr) throw iErr;

      const itemList = (items ?? []) as MentorItem[];
      const ids = itemList.map((x) => x.id);

      if (ids.length === 0) {
        setMentorItems([]);
        setMentorFlags({});
        setMentorLikeCounts({});
        return;
      }

      // 2) 내 flags 로드 (liked/completed)
      const { data: flags, error: fErr } = await supabase
        .from('mentor_item_user_flags')
        .select('user_id,item_id,liked,completed,updated_at')
        .eq('user_id', user.id)
        .in('item_id', ids);
      if (fErr) throw fErr;

      const flagMap: Record<string, MentorFlag> = {};
      (flags ?? []).forEach((r) => {
        flagMap[r.item_id] = r as any;
      });

      // 3) like_count 로드 (view)
      const { data: counts, error: cErr } = await supabase
        .from('mentor_item_like_counts')
        .select('item_id,like_count')
        .in('item_id', ids);
      if (cErr) throw cErr;

      const likeMap: Record<string, number> = {};
      (counts ?? []).forEach((r) => {
        likeMap[r.item_id] = Number(r.like_count ?? 0);
      });

      // 4) mineOnly 필터
      let filtered = itemList;
      if (mentorMineOnly) {
        filtered = filtered.filter((it) => flagMap[it.id]?.liked === true);
      }

      // 5) 정렬
      const sorted = [...filtered].sort((a, b) => {
        const aLike = likeMap[a.id] ?? 0;
        const bLike = likeMap[b.id] ?? 0;

        if (mentorSort === 'recommended') {
          // 찜 많은 순 → 같은 경우 최신순
          if (bLike !== aLike) return bLike - aLike;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }

        // 최신순
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setMentorItems(sorted);
      setMentorFlags(flagMap);
      setMentorLikeCounts(likeMap);
    } catch (e: any) {
      alert(e?.message ?? '스승을 만나다 로드 실패');
    } finally {
      setMentorLoading(false);
    }
  };

  useEffect(() => {
    loadMentor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorTab, mentorSort, mentorMineOnly]);

  // =========================
  // ✅ 토글: 찜(liked)
  // - upsert로 즉시 반영
  // - likeCount도 optimistic 업데이트
  // =========================
  const toggleLike = async (item: MentorItem) => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      const current = mentorFlags[item.id]?.liked === true;
      const next = !current;

      // optimistic update
      setMentorFlags((prev) => ({
        ...prev,
        [item.id]: {
          user_id: user.id,
          item_id: item.id,
          liked: next,
          completed: prev[item.id]?.completed ?? false,
          updated_at: new Date().toISOString(),
        },
      }));

      setMentorLikeCounts((prev) => {
        const base = prev[item.id] ?? 0;
        const updated = Math.max(0, base + (next ? 1 : -1));
        return { ...prev, [item.id]: updated };
      });

      // DB upsert
      const payload = {
        user_id: user.id,
        item_id: item.id,
        liked: next,
        completed: mentorFlags[item.id]?.completed ?? false,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('mentor_item_user_flags')
        .upsert(payload, { onConflict: 'user_id,item_id' });
      if (error) throw error;

      // mineOnly ON이면: 찜 해제시 리스트에서 즉시 사라져야 자연스러움
      if (mentorMineOnly && !next) {
        setMentorItems((prev) => prev.filter((x) => x.id !== item.id));
      } else {
        // 정렬 재적용(추천순이라면 찜수 변경 반영)
        setMentorItems((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const list = ids.has(item.id) ? prev : [item, ...prev];
          return [...list].sort((a, b) => {
            const aLike = (item.id === a.id ? (mentorLikeCounts[a.id] ?? 0) + (next ? 1 : -1) : mentorLikeCounts[a.id] ?? 0);
            const bLike = (item.id === b.id ? (mentorLikeCounts[b.id] ?? 0) + (next ? 1 : -1) : mentorLikeCounts[b.id] ?? 0);

            if (mentorSort === 'recommended') {
              if (bLike !== aLike) return bLike - aLike;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        });
      }
    } catch (e: any) {
      alert(e?.message ?? '찜 토글 실패');
      // 실패 시 전체 리로드로 회복
      loadMentor();
    }
  };

  // =========================
  // ✅ 토글: 완료(completed)
  // =========================
  const toggleCompleted = async (item: MentorItem) => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      const current = mentorFlags[item.id]?.completed === true;
      const next = !current;

      // optimistic update
      setMentorFlags((prev) => ({
        ...prev,
        [item.id]: {
          user_id: user.id,
          item_id: item.id,
          liked: prev[item.id]?.liked ?? false,
          completed: next,
          updated_at: new Date().toISOString(),
        },
      }));

      const payload = {
        user_id: user.id,
        item_id: item.id,
        liked: mentorFlags[item.id]?.liked ?? false,
        completed: next,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('mentor_item_user_flags')
        .upsert(payload, { onConflict: 'user_id,item_id' });
      if (error) throw error;
    } catch (e: any) {
      alert(e?.message ?? '완료 토글 실패');
      loadMentor();
    }
  };

  const completedLabel = (it: MentorItem, completed: boolean) => {
    if (it.type === 'book') return completed ? '읽음' : '아직 안읽음';
    // youtube, movie
    return completed ? '시청함' : '아직 안봄';
  };

  // =========================
  // UI
  // =========================
  return (
    <>
      {/* 상단 */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-neutral-100">
        <div className="px-4 py-3 text-sm font-semibold text-neutral-900">프로필</div>
      </div>

      <main className="px-4 py-4 space-y-4">
        {/* 프로필 카드 */}
        {profile.role === 'admin' && (
  <>
    {/* ✅ 검색바처럼 보이는 버튼 */}
    <button
      type="button"
      onClick={() => setOpenUserSearch(true)}
      className={cn(
        'w-full rounded-2xl border border-neutral-200 bg-neutral-50',
        'px-4 py-3',
        'flex items-center justify-center gap-2',
        'text-sm font-semibold text-neutral-800',
        'hover:bg-neutral-100 transition'
      )}
    >
      <span>식구 검색하기</span>
      <span className="text-neutral-500">🔎</span>
      <span className="text-neutral-400 font-medium">(식구 현황 + 피드 보기)</span>
    </button>

    <BottomSheet
      open={openUserSearch}
      onClose={() => setOpenUserSearch(false)}
      title="식구를 찾아봐요!"
      description="식구의 현황과 피드를 볼 수 있어요:)"
    >
      <div className="pb-6">
        <UserSearchAdmin isAdmin />
      </div>
    </BottomSheet>
  </>
)}
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center text-white text-2xl font-bold">
              {profile.name?.charAt(0) ?? 'U'}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-lg font-bold text-neutral-900">{profile.name}</h2>

                {/* 프로필 수정 버튼 */}
<button
  type="button"
  onClick={() => router.push('/profile/edit')}
  className="ml-auto px-3 py-1.5 rounded-xl border border-neutral-200 text-xs hover:bg-neutral-50"
>
  ✏️ 프로필 수정
</button>

                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded',
                    profile.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-neutral-100 text-neutral-600'
                  )}
                >
                  {USER_ROLE_LABELS[profile.role]}
                </span>

                {/* ✅ 수강생만: 내 강의 등록하기 버튼 (작게) */}
                {profile.role === 'student' && (
                  <button
                    type="button"
                    onClick={() => router.push('/profile/register')}
                    className="ml-auto px-3 py-1.5 rounded-xl border border-neutral-200 text-xs hover:bg-neutral-50"
                  >
                    📌 내 강의 등록
                  </button>
                )}
              </div>

              <p className="text-sm text-neutral-500">{profile.email}</p>
              {profile.phone && <p className="text-sm text-neutral-500">{profile.phone}</p>}

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {myLectureRegs.length === 0 ? (
                  <span className="text-xs text-neutral-400">아직 내 강의를 등록하지 않았어요.</span>
                ) : (
                  myLectureRegs.slice(0, 3).map((r) => (
                    <span key={r.id} className={cn('inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-neutral-200', getRegionColor(r.region))}>
                      <MapPin className="w-3 h-3" />
                      {r.region} / {r.level}
                    </span>
                  ))
                )}
                {myLectureRegs.length > 3 && (
                  <span className="text-xs text-neutral-400">+{myLectureRegs.length - 3}개</span>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between">
                <span className="text-sm text-neutral-500">계정 상태</span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    profile.status === 'approved'
                      ? 'text-secondary-600'
                      : profile.status === 'pending'
                      ? 'text-amber-600'
                      : 'text-red-600'
                  )}
                >
                  {USER_STATUS_LABELS[profile.status]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ 알림받는 강의 (기존 알림받기 섹션 디자인을 즐겨찾기처럼) */}
        <Link href="/notifications" className="bg-white rounded-2xl border border-neutral-100 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-neutral-700" />
            </div>
            <div>
              <h3 className="font-medium text-neutral-900">알림받는 강의</h3>
              <p className="text-sm text-neutral-500">내가 알림받는 강의를 모아봐요!</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-400" />
        </Link>

        {/* 즐겨찾는 강의 */}
        <Link href="/favorites" className="bg-white rounded-2xl border border-neutral-100 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Star className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-medium text-neutral-900">즐겨찾는 강의</h3>
              <p className="text-sm text-neutral-500">내가 즐겨찾는 강의를 모아봐요!</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-400" />
        </Link>

        {/* 납부 내역 */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-neutral-900">납부 내역</h3>
                <p className="text-sm text-neutral-500">총 {formatCurrency(paymentStats.totalPaid)} 납부</p>
              </div>
            </div>
          </div>

          {payments.length > 0 ? (
            <div className="space-y-2">
              {payments.slice(0, 3).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-2 border-t border-neutral-100">
                  <div>
                    <span className="text-sm font-medium text-neutral-900">{payment.month}</span>
                    <span className="text-sm text-neutral-500 ml-2">{formatCurrency(payment.amount)}</span>
                  </div>
                  <span
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded',
                      payment.paid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    )}
                  >
                    {payment.paid ? (
                      <>
                        <Check className="w-3 h-3" /> 납부완료
                      </>
                    ) : (
                      <>
                        <X className="w-3 h-3" /> 미납
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400 text-center py-4">납부 내역이 없습니다</p>
          )}
        </div>

        {/* =========================
            ✅ 스승을 만나다
           ========================= */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-neutral-900">스승을 만나다</div>
            {profile.role === 'admin' && (
              <Link href="/admin/mentor" className="text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded-lg">
                관리자 등록
              </Link>
            )}
          </div>

          {/* 탭 + 정렬 + mine only */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {(['book', 'youtube', 'movie'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMentorTab(t)}
                className={cn(
                  'px-3 py-2 rounded-xl text-sm border',
                  mentorTab === t ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                )}
              >
                {t === 'book' ? '책' : t === 'youtube' ? '유튜브' : '영화'}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <select
                value={mentorSort}
                onChange={(e) => setMentorSort(e.target.value as MentorSortMode)}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="latest">최신순(최근 등록)</option>
                <option value="recommended">추천순(찜 많은 순)</option>
              </select>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mentorMineOnly}
                  onChange={(e) => setMentorMineOnly(e.target.checked)}
                />
                내가 찜한것만
              </label>
            </div>
          </div>

          {/* 리스트 */}
          <div className="mt-3 space-y-2">
            {mentorLoading ? (
              <div className="text-sm text-neutral-500 py-6 text-center">불러오는 중…</div>
            ) : mentorItems.length === 0 ? (
              <div className="text-sm text-neutral-500 py-6 text-center">
                {mentorMineOnly ? '내가 찜한 추천이 아직 없어요 🙂' : '추천 콘텐츠가 아직 없어요 🙂'}
              </div>
            ) : (
              mentorItems.map((it) => {
                const liked = mentorFlags[it.id]?.liked === true;
                const completed = mentorFlags[it.id]?.completed === true;
                const likeCount = mentorLikeCounts[it.id] ?? 0;

                return (
                  <div key={it.id} className="rounded-2xl border border-neutral-100 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-neutral-900 truncate">{it.title}</div>

                        <div className="mt-1 text-xs text-neutral-500 flex flex-wrap items-center gap-2">
                          <span className="px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-700">
                            {it.type === 'book' ? '책' : it.type === 'youtube' ? '유튜브' : '영화'}
                          </span>
                          {it.creator && <span>{it.creator}</span>}
                          <span className="text-neutral-300">·</span>
                          <span>❤️ {likeCount}</span>
                        </div>

                        {it.note && <div className="mt-2 text-sm text-neutral-700 whitespace-pre-wrap">{it.note}</div>}

                        {it.url && (
                          <a
                            href={it.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-sm text-blue-600 underline"
                          >
                            링크 열기
                          </a>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleLike(it)}
                          className={cn(
                            'rounded-xl px-3 py-2 text-sm border',
                            liked ? 'bg-pink-50 text-pink-700 border-pink-200' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                          )}
                        >
                          {liked ? '찜뽕 ❤️' : '찜하기 🤍'} <span className="text-xs text-neutral-500">{likeCount}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleCompleted(it)}
                          className={cn(
                            'rounded-xl px-3 py-2 text-sm border',
                            completed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                          )}
                        >
                          {completedLabel(it, completed)}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 로그아웃 */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full bg-white rounded-2xl border border-neutral-100 p-4 flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 transition-colors"
        >
          {loggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
          로그아웃
        </button>

        {profile.referrer && <p className="text-xs text-neutral-400 text-center">추천인: {profile.referrer}</p>}
      </main>
    </>
  );
}