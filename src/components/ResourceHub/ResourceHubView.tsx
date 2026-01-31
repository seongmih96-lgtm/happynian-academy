'use client';

import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ExternalLink,
  Heart,
  Calendar,
  CheckCircle2,
  Clock,
  Circle,
  Video,
  Folder,
} from 'lucide-react';
import { cn, formatKoreanDate, formatTimeRange } from '@/lib/utils';
import VideoPlayerModal from '@/components/ResourceHub/VideoPlayerModal';

type HubType = 'student' | 'instructor';

type Props = {
  hub: any;
  hubType?: HubType; // ✅ 추측 금지. 명시적으로 넘겨!
  headerTitle?: string;
  headerSub?: string;
  showInstructorButton?: boolean;
  onInstructorClick?: () => void;
};

function TopTab({ active, onClick, icon, label }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl px-3 py-2 border text-sm flex items-center justify-center gap-2',
        active
          ? 'bg-neutral-900 text-white border-neutral-900'
          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusChip({ active, onClick, label, count, icon }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl px-3 py-2 border text-xs flex items-center justify-between gap-2',
        active
          ? 'bg-neutral-900 text-white border-neutral-900'
          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
      )}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          'text-[11px] px-2 py-[2px] rounded-full',
          active ? 'bg-white/15' : 'bg-neutral-100'
        )}
      >
        {count}
      </span>
    </button>
  );
}

export default function ResourceHubView({
  hub,
  hubType = 'student',
  headerTitle = '강의실',
  headerSub = '오늘의 배움이 식구의 하루를 더 단단하게 🌿',
  showInstructorButton = false,
  onInstructorClick,
}: Props) {
  const isInstructorHub = hubType === 'instructor';

  const {
    // tabs
    resourceTab,
    setResourceTab,

    // student-only watch
    watchTab,
    setWatchTab,

    // sorting
    sortMode,
    setSortMode,
    sortOpen,
    setSortOpen,
    sortWrapRef,

    // favorites
    favSet,
    favKey, // ✅ 반드시 hub에서 내려주게 만들 것
    onlyFavorites,
    setOnlyFavorites,

    // helpers/data
    getUrl,
    touchProgress,
    tabTitle,
    nowCtaText,
    continueList,
    rows,
    videoCounts,
    progressMap,
    watchMap,

    // actions
    openLink,
    toggleFavorite,
    setWatchStatus,
  } = hub;

  // ✅ 강사/학생 허브 정렬 옵션
  const sortOptions = useMemo(() => {
    if (isInstructorHub) {
      return [
        { value: 'latest', label: '최신순' },
        { value: 'recommended', label: '추천순(찜 많은순)' },
      ];
    }
    return [
      { value: 'nearest', label: '가까운순' },
      { value: 'recommended', label: '추천순(찜 많은순)' },
    ];
  }, [isInstructorHub]);

  const sortLabel = useMemo(() => {
    const found = sortOptions.find((x) => x.value === sortMode);
    return found?.label ?? '정렬';
  }, [sortMode, sortOptions]);

  // 모달
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerSession, setPlayerSession] = useState<any>(null);
  const [playerUrl, setPlayerUrl] = useState<string>('');

  // ✅ 영상이면 모달 / 아니면 새탭
  const openResource = async (s: any) => {
    if (resourceTab === 'video') {
      const url = getUrl?.(s, 'video') || s?.url || '';
      if (!url) return;

      // 강의실(student)일 때만 시청상태/진행률 처리
      if (!isInstructorHub) {
        const cur = (watchMap?.[s.id] ?? 'before') as any;
        if (cur === 'before') await setWatchStatus(s.id, 'watching');
        touchProgress?.(s.id);
      }

      setPlayerSession(s);
      setPlayerUrl(url);
      setPlayerOpen(true);
      return;
    }

    openLink(s);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <VideoPlayerModal
        open={playerOpen}
        title={playerSession?.title ?? '강의영상'}
        url={playerUrl}
        onClose={() => {
          setPlayerOpen(false);
          setPlayerSession(null);
          setPlayerUrl('');
        }}
        onEnded={async () => {
          if (!isInstructorHub && playerSession?.id) {
            await setWatchStatus(playerSession.id, 'done');
          }
        }}
      />

      {/* 헤더 */}
      <div className="sticky top-0 z-20 bg-neutral-50/90 backdrop-blur border-b border-neutral-100">
        <div className="mx-auto w-full max-w-3xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-neutral-900">{headerTitle}</div>
            <div className="text-xs text-neutral-500 mt-0.5">{headerSub}</div>
          </div>

          {showInstructorButton && (
            <button
              type="button"
              onClick={onInstructorClick}
              className="text-xs px-3 py-2 rounded-xl bg-neutral-900 text-white hover:opacity-90"
            >
              강사 전용 콘텐츠 🎓
            </button>
          )}
        </div>

        {/* 탭 */}
        <div className="mx-auto w-full max-w-3xl px-4 pb-3">
          <div className="grid grid-cols-3 gap-2">
            <TopTab
              active={resourceTab === 'video'}
              onClick={() => setResourceTab('video')}
              icon={<Video className="w-4 h-4" />}
              label="강의영상"
            />
            <TopTab
              active={resourceTab === 'zoom'}
              onClick={() => setResourceTab('zoom')}
              icon={<ExternalLink className="w-4 h-4" />}
              label="Zoom"
            />
            <TopTab
              active={resourceTab === 'materials'}
              onClick={() => setResourceTab('materials')}
              icon={<Folder className="w-4 h-4" />}
              label="자료"
            />
          </div>

          {/* ✅ 내가 찜한 것만 모아보기 ON/OFF (둘 다 사용) */}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setOnlyFavorites?.((v: boolean) => !v)}
              className={cn(
                'w-full rounded-xl px-3 py-2 border text-sm',
                onlyFavorites
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
              )}
            >
              {onlyFavorites ? '내가 찜한 것만 보는 중 ✅' : '내가 찜한 것만 모아보기 ON'}
            </button>
          </div>

          {/* ✅ 시청칩은 “강의실(student)” + 영상탭에서만 */}
          {!isInstructorHub && resourceTab === 'video' && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <StatusChip
                active={watchTab === 'before'}
                onClick={() => setWatchTab('before')}
                label="아직 시작하지 않은 강의"
                count={videoCounts?.before ?? 0}
                icon={<Circle className="w-4 h-4" />}
              />
              <StatusChip
                active={watchTab === 'watching'}
                onClick={() => setWatchTab('watching')}
                label="지금 배우고 있는 강의"
                count={videoCounts?.watching ?? 0}
                icon={<Clock className="w-4 h-4" />}
              />
              <StatusChip
                active={watchTab === 'done'}
                onClick={() => setWatchTab('done')}
                label="끝까지 함께한 강의"
                count={videoCounts?.done ?? 0}
                icon={<CheckCircle2 className="w-4 h-4" />}
              />
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 py-4 space-y-4">
        {/* ✅ 이어보기는 강의실(student)에서만 */}
        {!isInstructorHub && resourceTab === 'video' && (continueList?.length ?? 0) > 0 && (
          <section className="bg-white rounded-2xl border border-neutral-100 p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm font-semibold text-neutral-900">이어보기</div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  멈춘 곳부터 다시, 오늘도 성장해요 💛
                </div>
              </div>
              <span className="text-xs text-neutral-500">{continueList.length}개</span>
            </div>

            <div className="mt-3 space-y-2">
              {continueList.slice(0, 3).map(({ s, percent }: any) => (
                <div key={s.id} className="rounded-2xl border border-neutral-100 p-4">
                  <div className="text-sm font-semibold text-neutral-900">{s.title}</div>
                  <div className="mt-1 text-xs text-neutral-500">진행률 {percent}%</div>

                  <div className="mt-2 h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-full bg-neutral-900" style={{ width: `${percent}%` }} />
                  </div>

                  <button
                    type="button"
                    onClick={() => openResource(s)}
                    className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-medium bg-neutral-900 text-white hover:opacity-90"
                  >
                    지금 이어보기
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 리스트 */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-neutral-900">{tabTitle}</div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {sortMode === 'recommended'
                  ? '식구들이 많이 찜한 순으로 모았어요 💛'
                  : isInstructorHub
                  ? '가장 최근 업로드부터 보여줘요 🆕'
                  : '가까운 일정부터 차근차근 정리했어요 🙂'}
              </div>
            </div>

            <div className="relative" ref={sortWrapRef}>
              <button
                type="button"
                onClick={() => setSortOpen((v: boolean) => !v)}
                className="px-3 py-2 rounded-xl border border-neutral-200 text-sm flex items-center gap-2 hover:bg-neutral-50"
              >
                {sortLabel}
                <ChevronDown className="w-4 h-4 text-neutral-500" />
              </button>

              {sortOpen && (
                <div className="absolute right-0 mt-2 w-[220px] bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden z-10">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSortMode(opt.value);
                        setSortOpen(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-neutral-50',
                        sortMode === opt.value && 'font-semibold'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {(rows?.length ?? 0) === 0 ? (
              <div className="text-sm text-neutral-500 py-10 text-center">
                아직 등록된 {tabTitle} 링크가 없어요.
              </div>
            ) : (
              rows.map(({ s, favCount }: any) => {
                // ✅ 찜 체크는 무조건 hub의 favKey를 써야 함(스코프 포함 구조)
                const isFav = favSet?.has?.(favKey(s.id, resourceTab)) ?? false;

                const videoStatus = watchMap?.[s.id] ?? 'before';
                const percent = resourceTab === 'video' ? (progressMap?.[s.id]?.percent ?? 0) : 0;

                const uploadDate = s?.created_at
                  ? formatKoreanDate(s.created_at)
                  : s?.updated_at
                  ? formatKoreanDate(s.updated_at)
                  : '';

                return (
                  <div key={s.id} className="bg-white border border-neutral-100 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-neutral-900 truncate">{s.title}</div>

                        {/* ✅ 강사전용 코멘트 */}
                        {isInstructorHub && (s.comment ?? '').trim() !== '' && (
                          <div className="mt-1 text-xs text-neutral-600 whitespace-pre-wrap">{s.comment}</div>
                        )}

                        <div className="mt-2 text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
                          <Calendar className="w-4 h-4" />

                          {isInstructorHub ? (
                            <span>업로드 {uploadDate}</span>
                          ) : (
                            <>
                              <span>{formatKoreanDate(s.start_at)}</span>
                              <span className="text-neutral-300">·</span>
                              <span>{formatTimeRange(s.start_at, s.end_at)}</span>
                            </>
                          )}

                          {!isInstructorHub && resourceTab === 'video' && (
                            <span
                              className={cn(
                                'text-[11px] px-2 py-[2px] rounded-full border',
                                videoStatus === 'before' && 'bg-neutral-100 text-neutral-600 border-neutral-200',
                                videoStatus === 'watching' && 'bg-indigo-50 text-indigo-700 border-indigo-100',
                                videoStatus === 'done' && 'bg-blue-50 text-blue-700 border-blue-100'
                              )}
                            >
                              {videoStatus === 'before'
                                ? '시청전'
                                : videoStatus === 'watching'
                                ? '시청중'
                                : '완료'}
                            </span>
                          )}
                        </div>

                        {/* ✅ 진행률/시청버튼은 강의실에서만 */}
                        {!isInstructorHub && resourceTab === 'video' && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-neutral-600">
                              <span>진행률</span>
                              <span>{percent}%</span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                              <div className="h-full bg-neutral-900" style={{ width: `${percent}%` }} />
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2">
                              <button
                                type="button"
                                onClick={() => setWatchStatus(s.id, 'before')}
                                className={cn(
                                  'rounded-xl px-3 py-2 text-xs border',
                                  videoStatus === 'before'
                                    ? 'bg-neutral-900 text-white border-neutral-900'
                                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                                )}
                              >
                                시청전
                              </button>
                              <button
                                type="button"
                                onClick={() => setWatchStatus(s.id, 'watching')}
                                className={cn(
                                  'rounded-xl px-3 py-2 text-xs border',
                                  videoStatus === 'watching'
                                    ? 'bg-neutral-900 text-white border-neutral-900'
                                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                                )}
                              >
                                시청중
                              </button>
                              <button
                                type="button"
                                onClick={() => setWatchStatus(s.id, 'done')}
                                className={cn(
                                  'rounded-xl px-3 py-2 text-xs border',
                                  videoStatus === 'done'
                                    ? 'bg-neutral-900 text-white border-neutral-900'
                                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                                )}
                              >
                                완료
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 오른쪽 액션 */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(s.id, resourceTab)}
                          className={cn(
                            'px-3 py-2 rounded-xl border text-sm flex items-center gap-2',
                            isFav
                              ? 'bg-rose-50 text-rose-700 border-rose-100'
                              : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                          )}
                          title="찜하기"
                        >
                          <Heart className={cn('w-4 h-4', isFav && 'fill-current')} />
                          <span className="text-xs">{favCount ?? 0}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openResource(s)}
                          className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm hover:opacity-90 flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          {nowCtaText}
                        </button>
                      </div>
                    </div>
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