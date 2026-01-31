'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, ExternalLink, FileText, Play, CheckCircle2, PauseCircle } from 'lucide-react';

import { Header } from '@/components/layout/Header';
import { cn, formatKoreanDate, formatTimeRange } from '@/lib/utils';
import type { Session, Profile } from '@/types';

/* =========================
 UI TOKENS (디자인 통일)
========================= */
const UI = {
  page: 'min-h-screen bg-neutral-50',
  section: 'bg-white rounded-2xl border border-neutral-100 p-4',
  titleRow: 'flex items-center justify-between gap-2',
  title: 'text-sm font-semibold text-neutral-900',
  sub: 'text-xs text-neutral-500',

  // 상태 pills
  pill: 'inline-flex items-center gap-1 text-[11px] px-2 py-[3px] rounded-full border',
  pillTodo: 'bg-neutral-50 text-neutral-700 border-neutral-200',
  pillDoing: 'bg-blue-50 text-blue-700 border-blue-100',
  pillDone: 'bg-emerald-50 text-emerald-700 border-emerald-100',

  // CTA
  cta: 'w-full rounded-2xl px-4 py-3 text-sm font-semibold flex items-center justify-between transition',
  ctaOn: 'bg-neutral-900 text-white hover:opacity-90',
  ctaOff: 'bg-neutral-100 text-neutral-400 cursor-not-allowed',

  // 토글
  tabRow: 'flex gap-2',
  tab: 'flex-1 rounded-2xl px-3 py-2 text-sm border transition',
  tabOn: 'bg-neutral-900 text-white border-neutral-900',
  tabOff: 'bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-50',

  // 정렬
  sortRow: 'flex gap-2 mt-3',
  sort: 'flex-1 rounded-xl px-3 py-2 text-xs border transition',
  sortOn: 'bg-neutral-100 text-neutral-900 border-neutral-200',
  sortOff: 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50',

  // 카드
  card: 'rounded-2xl border border-neutral-100 bg-white p-4',
  cardTitle: 'text-base font-semibold text-neutral-900',
  meta: 'text-sm text-neutral-600',
  progressWrap: 'mt-3 rounded-xl bg-neutral-100 overflow-hidden',
  progressBar: 'h-2 bg-neutral-900',
  progressText: 'mt-2 text-xs text-neutral-600 flex items-center justify-between',

  // 버튼
  btn: 'w-full rounded-xl px-4 py-3 text-sm flex items-center justify-between border transition',
  btnPrimary: 'bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-900',
};

type MainTab = 'video' | 'zoom' | 'materials';
type SortMode = 'week' | 'nearest';

function ymdKst(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function isTodayKst(dateIso: string) {
  const today = ymdKst(new Date());
  return ymdKst(new Date(dateIso)) === today;
}

function isOngoingKst(startIso: string, endIso?: string | null) {
  const tz = 'Asia/Seoul';
  const nowKstMs = new Date(new Date().toLocaleString('en-US', { timeZone: tz })).getTime();
  const startMs = new Date(startIso).getTime();
  const endMs = endIso ? new Date(endIso).getTime() : null;

  if (!endMs) return nowKstMs >= startMs;
  return nowKstMs >= startMs && nowKstMs <= endMs;
}

/**
 * ✅ 임시 progress (나중에 watch_progress 테이블 붙이면 됨)
 * - 완료/시청중/시청전 UX 확인용
 */
function getMockProgress(sessionId: string) {
  // sessionId 기반으로 항상 동일한 값이 나오게(새로고침에도 안정)
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) hash = (hash * 31 + sessionId.charCodeAt(i)) >>> 0;
  const pct = hash % 101; // 0~100
  return pct;
}

export default function ClassroomClient({
  profile,
  sessions,
}: {
  profile: Profile | null;
  sessions: Session[];
}) {
  const router = useRouter();

  const role = (profile as any)?.role as 'student' | 'admin' | undefined;
  const isAdmin = role === 'admin';

  const [tab, setTab] = useState<MainTab>('video');
  const [sortMode, setSortMode] = useState<SortMode>('nearest');

  // ✅ “오늘/진행중” 우선 CTA 대상
  const nowTarget = useMemo(() => {
    const list = [...(sessions ?? [])].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

    const ongoing = list.find((s) => isOngoingKst(s.start_at, (s as any).end_at));
    if (ongoing) return ongoing;

    const today = list.find((s) => isTodayKst(s.start_at));
    if (today) return today;

    return list[0] ?? null;
  }, [sessions]);

  // ✅ 상태(시청전/중/완) + 진행률
  const progressPct = useMemo(() => {
    if (!nowTarget) return 0;
    return getMockProgress(nowTarget.id);
  }, [nowTarget]);

  const watchState = useMemo(() => {
    if (!nowTarget) return 'none' as const;
    if (progressPct >= 100) return 'done' as const;
    if (progressPct > 0) return 'doing' as const;
    return 'todo' as const;
  }, [nowTarget, progressPct]);

  const statePill = useMemo(() => {
    if (watchState === 'done')
      return { label: '완료', Icon: CheckCircle2, cls: cn(UI.pill, UI.pillDone) };
    if (watchState === 'doing')
      return { label: '시청중', Icon: PauseCircle, cls: cn(UI.pill, UI.pillDoing) };
    return { label: '시청전', Icon: Play, cls: cn(UI.pill, UI.pillTodo) };
  }, [watchState]);

  // ✅ 리스트 정렬
  const list = useMemo(() => {
    const arr = [...(sessions ?? [])];

    if (sortMode === 'nearest') {
      return arr.sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      );
    }

    // week: 주차(세션_no) 기준 -> 같은 주차면 날짜 가까운순
    return arr.sort((a, b) => {
      const an = (a as any).session_no ?? 0;
      const bn = (b as any).session_no ?? 0;
      if (an !== bn) return an - bn;
      return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    });
  }, [sessions, sortMode]);

  // ✅ 탭별 URL getter
  const getUrl = (s: Session) => {
    if (tab === 'video') return (s as any).classroom_url ?? '';
    if (tab === 'zoom') return (s as any).zoom_url ?? '';
    return (s as any).materials_url ?? '';
  };

  // ✅ “지금 바로 보기”는 강의 영상 기준
  const nowVideoUrl = nowTarget ? ((nowTarget as any).classroom_url ?? '') : '';

  const openLink = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={UI.page}>
      <Header
        title="강의실"
        rightActions={
          <>
            {isAdmin && (
              <button
                type="button"
                onClick={() => router.push('/instructor')}
                className="px-3 py-2 rounded-xl border border-neutral-200 bg-white text-sm hover:bg-neutral-50"
              >
                강사전용
              </button>
            )}
          </>
        }
      />

      <main className="px-4 pb-8 space-y-3">
        {/* 1) 상태 */}
        <section className={UI.section}>
          <div className={UI.titleRow}>
            <div>
              <div className={UI.title}>시청 상태</div>
              <div className={UI.sub}>지금 내 강의 진행 상태를 한눈에</div>
            </div>

            <span className={statePill.cls}>
              <statePill.Icon className="w-3.5 h-3.5" />
              {statePill.label}
            </span>
          </div>
        </section>

        {/* 2) 지금 바로 보기 */}
        <section className={UI.section}>
          <div className={UI.titleRow}>
            <div>
              <div className={UI.title}>지금 바로 보기</div>
              <div className={UI.sub}>오늘/진행중 강의가 있으면 여기서 바로</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openLink(nowVideoUrl)}
            disabled={!nowVideoUrl}
            className={cn(UI.cta, nowVideoUrl ? UI.ctaOn : UI.ctaOff)}
          >
            <span className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              {nowTarget ? `${(nowTarget as any).title ?? '강의'} 지금 보기` : '지금 볼 강의가 없어요'}
            </span>
            <span className="text-xs opacity-80">{nowVideoUrl ? '열기' : '준비중'}</span>
          </button>
        </section>

        {/* 3) 진행률 + 이어보기 */}
        <section className={UI.section}>
          <div className={UI.titleRow}>
            <div>
              <div className={UI.title}>시청 진행률</div>
              <div className={UI.sub}>이어보기로 바로 이어서 시청</div>
            </div>
          </div>

          <div className={UI.progressWrap}>
            <div className={UI.progressBar} style={{ width: `${progressPct}%` }} />
          </div>

          <div className={UI.progressText}>
            <span>{progressPct}%</span>
            <span className="text-neutral-500">
              {nowTarget ? formatKoreanDate(nowTarget.start_at, 'M월 d일 (E)') : ''}
            </span>
          </div>

          <button
            type="button"
            onClick={() => openLink(nowVideoUrl)}
            disabled={!nowVideoUrl}
            className={cn('mt-3', UI.btn, UI.btnPrimary, !nowVideoUrl && 'opacity-60 cursor-not-allowed')}
          >
            <span className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              이어보기
            </span>
            <span className="text-xs text-neutral-500">계속 시청</span>
          </button>
        </section>

        {/* 4) 토글 + 리스트 */}
        <section className={UI.section}>
          <div className={UI.titleRow}>
            <div>
              <div className={UI.title}>전체 콘텐츠</div>
              <div className={UI.sub}>영상/줌/자료를 한 곳에서</div>
            </div>
          </div>

          <div className={cn(UI.tabRow, 'mt-3')}>
            <button
              type="button"
              onClick={() => setTab('video')}
              className={cn(UI.tab, tab === 'video' ? UI.tabOn : UI.tabOff)}
            >
              <span className="flex items-center justify-center gap-2">
                <Video className="w-4 h-4" /> 강의 영상
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab('zoom')}
              className={cn(UI.tab, tab === 'zoom' ? UI.tabOn : UI.tabOff)}
            >
              <span className="flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" /> 줌 미팅
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab('materials')}
              className={cn(UI.tab, tab === 'materials' ? UI.tabOn : UI.tabOff)}
            >
              <span className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" /> 자료
              </span>
            </button>
          </div>

          <div className={UI.sortRow}>
            <button
              type="button"
              onClick={() => setSortMode('week')}
              className={cn(UI.sort, sortMode === 'week' ? UI.sortOn : UI.sortOff)}
            >
              주차순
            </button>
            <button
              type="button"
              onClick={() => setSortMode('nearest')}
              className={cn(UI.sort, sortMode === 'nearest' ? UI.sortOn : UI.sortOff)}
            >
              가까운순
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {list.length === 0 ? (
              <div className="text-sm text-neutral-500">등록된 강의가 없어요.</div>
            ) : (
              list.map((s) => {
                const url = getUrl(s);
                const pct = getMockProgress(s.id);
                const title = (s as any).title ?? '강의';
                return (
                  <div key={s.id} className={UI.card}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className={UI.cardTitle}>{title}</div>
                        <div className={cn(UI.meta, 'mt-1')}>
                          {formatKoreanDate(s.start_at, 'M월 d일 (E)')} · {formatTimeRange(s.start_at, (s as any).end_at)}
                        </div>
                        <div className={cn(UI.meta, 'mt-1 text-xs text-neutral-500')}>
                          {(s as any).region} · {(s as any).level} · {(s as any).session_no}회차
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openLink(url)}
                        disabled={!url}
                        className={cn(
                          'px-3 py-2 rounded-xl text-sm border transition',
                          url
                            ? 'bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-900'
                            : 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed'
                        )}
                      >
                        열기
                      </button>
                    </div>

                    {/* 영상 탭일 때만 진행률 보여주기 */}
                    {tab === 'video' && (
                      <>
                        <div className={cn(UI.progressWrap, 'mt-3')}>
                          <div className={UI.progressBar} style={{ width: `${pct}%` }} />
                        </div>
                        <div className={cn(UI.progressText)}>
                          <span className="text-xs text-neutral-600">진행 {pct}%</span>
                          <span className="text-xs text-neutral-500">{pct >= 100 ? '완료' : pct > 0 ? '시청중' : '시청전'}</span>
                        </div>
                      </>
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