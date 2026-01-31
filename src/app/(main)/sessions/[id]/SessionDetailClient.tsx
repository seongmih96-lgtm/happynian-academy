'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Star,
  Bell,
  MapPin,
  Layers,
  Calendar,
  Clock,
  User,
  Package,
  Video,
  ExternalLink,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import {
  cn,
  formatKoreanDate,
  formatTimeRange,
  getRegionColor,
  getLevelColor,
  formatMaterials,
} from '@/lib/utils';
import type { Session } from '@/types';
import { Toast } from '@/components/ui/Toast';

type SessionInstructorItem = {
  user_id: string;
  name?: string | null;
  role?: string | null; // main | sub | null
  sort_order?: number | null;
  period_no?: number | null; // ✅ 1~3교시
};

type SessionPeriod = {
  id: string;
  period_no: 1 | 2 | 3;
  title?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  instructors?: SessionInstructorItem[] | null;
};

function formatInstructorsLine(items?: SessionInstructorItem[] | null) {
  const list = (items ?? [])
    .filter(Boolean)
    .filter((x) => String(x?.name ?? '').trim().length > 0)
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));

  if (!list.length) return '';

  const main =
    list.find((x) => String(x.role ?? '').toLowerCase() === 'main')?.name ??
    list[0]?.name ??
    '';

  const subs = list
    .filter((x) => String(x.role ?? '').toLowerCase() === 'sub')
    .map((x) => String(x.name ?? '').trim())
    .filter(Boolean);

  if (!main) return '';

  return subs.length > 0 ? `${main} (서브: ${subs.join(', ')})` : main;
}

export default function SessionDetailClient({ session }: { session: Session }) {
  const router = useRouter();

  const levelKey = useMemo(
    () => `${(session as any).region}|${(session as any).level}`,
    [(session as any).region, (session as any).level]
  );

  const [isFavorited, setIsFavorited] = useState(false);
  const [isNotified, setIsNotified] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);
  const [loadingNoti, setLoadingNoti] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const startAt: any = (session as any)?.start_at ?? (session as any)?.startAt;
  const endAt: any = (session as any)?.end_at ?? (session as any)?.endAt;

  // ✅ KST 기준 TODAY/내일/D-N/진행중/종료 판정
  const dateStatus = useMemo(() => {
    const tz = 'Asia/Seoul';

    if (!startAt) {
      return {
        tag: 'unknown' as 'unknown' | 'today' | 'tomorrow' | 'future' | 'past',
        dText: '' as string,
        isOngoing: false,
        isEnded: false,
      };
    }

    const startDay = new Date(startAt).toLocaleDateString('en-CA', { timeZone: tz });
    const todayDay = new Date().toLocaleDateString('en-CA', { timeZone: tz });

    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    const tomorrowDay = tmr.toLocaleDateString('en-CA', { timeZone: tz });

    const kstMidnightMs = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`).getTime();

    const startMidMs = kstMidnightMs(startDay);
    const todayMidMs = kstMidnightMs(todayDay);

    const diffDays = Math.round((startMidMs - todayMidMs) / (24 * 60 * 60 * 1000));

    const nowMs = Date.now();
    const startMs = new Date(startAt).getTime();
    const endMs = endAt ? new Date(endAt).getTime() : null;

    const isOngoing = endMs ? nowMs >= startMs && nowMs <= endMs : nowMs >= startMs;
    const isEnded = endMs ? nowMs > endMs : false;

    let tag: 'today' | 'tomorrow' | 'future' | 'past' | 'unknown' = 'future';
    if (startDay === todayDay) tag = 'today';
    else if (startDay === tomorrowDay) tag = 'tomorrow';
    else if (diffDays < 0) tag = 'past';
    else tag = 'future';

    let dText = '';
    if (diffDays === 0) dText = 'D-DAY';
    else if (diffDays > 0) dText = `D-${diffDays}`;
    else dText = `D+${Math.abs(diffDays)}`;

    return { tag, dText, isOngoing, isEnded };
  }, [startAt, endAt]);

  const isToday = dateStatus.tag === 'today';
  const isTomorrow = dateStatus.tag === 'tomorrow';
  const isPast = dateStatus.tag === 'past';
  const dText = dateStatus.dText;
  const isOngoing = dateStatus.isOngoing;
  const isEnded = dateStatus.isEnded;

  const videoUrl = (session as any)?.classroom_url ?? '';
  const zoomUrl = (session as any)?.zoom_url ?? '';
  const materialsUrl = (session as any)?.materials_url ?? '';

  const openLink = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ✅ 교시(1~3) 데이터: title + instructors (배열/객체 모두 지원)
const periodMap = useMemo(() => {
  const raw = (session as any).periods;

  const m: Record<1 | 2 | 3, SessionPeriod | null> = { 1: null, 2: null, 3: null };

  // 1) periods가 객체 형태( {1:{...},2:{...},3:{...}} )로 오는 경우
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    ([1, 2, 3] as const).forEach((pn) => {
      const p = raw[pn];
      if (p) m[pn] = p as SessionPeriod;
    });
    return m;
  }

  // 2) periods가 배열 형태로 오는 경우
  const list = (Array.isArray(raw) ? raw : []) as SessionPeriod[];
  list.forEach((p) => {
    const no = Number((p as any).period_no) as 1 | 2 | 3;
    if (no === 1 || no === 2 || no === 3) m[no] = p;
  });

  return m;
}, [session]);

  // ✅ 상세 진입 시 즐겨찾기/알림 로드
  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const region = (session as any).region;
      const level = (session as any).level;

      const { data, error } = await supabase
        .from('favorites')
        .select('is_favorite, notify_enabled')
        .eq('user_id', user.id)
        .eq('region', region)
        .eq('level', level)
        .maybeSingle();

      if (!alive) return;
      if (error) {
        console.error('[favorites] load error:', error);
        return;
      }

      setIsFavorited(Boolean(data?.is_favorite));
      setIsNotified(Boolean(data?.notify_enabled));
    })();

    return () => {
      alive = false;
    };
  }, [levelKey, session]);

  const toggleFavorite = async () => {
    if (loadingFav) return;
    setLoadingFav(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        showToast('로그인 후 사용할 수 있어요 🙂');
        return;
      }

      const region = (session as any).region;
      const level = (session as any).level;

      const next = !isFavorited;

      const { error } = await supabase.from('favorites').upsert(
        {
          user_id: user.id,
          region,
          level,
          is_favorite: next,
          notify_enabled: isNotified ?? false,
        },
        { onConflict: 'user_id,region,level' }
      );

      if (error) {
        console.error('[favorites] upsert error:', error);
        showToast('잠시 후 다시 시도해주세요 🙏');
        return;
      }

      setIsFavorited(next);
      showToast(next ? '⭐ 즐겨찾기에 추가했어요' : '⭐ 즐겨찾기에서 해제했어요');
      router.refresh();
    } finally {
      setLoadingFav(false);
    }
  };

  const toggleNotify = async () => {
    if (loadingNoti) return;
    setLoadingNoti(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        showToast('로그인 후 사용할 수 있어요 🙂');
        return;
      }

      const region = (session as any).region;
      const level = (session as any).level;

      const next = !isNotified;

      const { error } = await supabase.from('favorites').upsert(
        {
          user_id: user.id,
          region,
          level,
          is_favorite: isFavorited ?? false,
          notify_enabled: next,
        },
        { onConflict: 'user_id,region,level' }
      );

      if (error) {
        console.error('[favorites] upsert error:', error);
        showToast('잠시 후 다시 시도해주세요 🙏');
        return;
      }

      setIsNotified(next);
      showToast(next ? '🔔 알림을 켰어요' : '🔕 알림을 껐어요');
      router.refresh();
    } finally {
      setLoadingNoti(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Toast open={toastOpen} message={toastMsg} onClose={() => setToastOpen(false)} />

      {/* 상단 바 */}
      <div className="sticky top-0 z-10 bg-neutral-50/90 backdrop-blur border-b border-neutral-100">
        <div className="mx-auto w-full max-w-3xl px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="min-w-[44px] min-h-[44px] -ml-2 px-2 rounded-xl hover:bg-neutral-100 flex items-center gap-1 text-neutral-700"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">뒤로</span>
          </button>

          <div className="text-sm font-semibold text-neutral-900">강의 상세</div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleFavorite}
              disabled={loadingFav}
              className={cn(
                'min-w-[44px] min-h-[44px] rounded-xl hover:bg-neutral-100 flex items-center justify-center transition',
                loadingFav && 'opacity-60 cursor-not-allowed'
              )}
              aria-label="즐겨찾기"
              title="즐겨찾기"
            >
              {loadingFav ? (
                <span className="w-4 h-4 rounded-full border-2 border-neutral-300 border-t-transparent animate-spin" />
              ) : (
                <Star className={cn('w-5 h-5', isFavorited ? 'text-amber-500 fill-amber-500' : 'text-neutral-400')} />
              )}
            </button>

            <button
              type="button"
              onClick={toggleNotify}
              disabled={loadingNoti}
              className={cn(
                'min-w-[44px] min-h-[44px] rounded-xl hover:bg-neutral-100 flex items-center justify-center transition',
                loadingNoti && 'opacity-60 cursor-not-allowed'
              )}
              aria-label="알림"
              title="알림"
            >
              {loadingNoti ? (
                <span className="w-4 h-4 rounded-full border-2 border-neutral-300 border-t-transparent animate-spin" />
              ) : (
                <Bell className={cn('w-5 h-5', isNotified ? 'text-blue-500 fill-blue-500' : 'text-neutral-400')} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="mx-auto w-full max-w-3xl px-4 py-4 space-y-3">
        {/* 상단 카드 */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={cn('badge border', getRegionColor((session as any).region))}>
              <MapPin className="w-3 h-3" />
              {(session as any).region}
            </span>

            <span className={cn('badge', getLevelColor((session as any).level))}>
              {(session as any).level}
            </span>

            <span className="badge bg-neutral-100 text-neutral-600">{(session as any).session_no}회차</span>

            {isToday && <span className="badge bg-red-50 text-red-700 border border-red-100">TODAY</span>}
            {isTomorrow && <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-100">내일</span>}

            {dText && <span className="badge bg-neutral-100 text-neutral-700 border border-neutral-200">{dText}</span>}

            {isOngoing && (
              <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-100">진행중</span>
            )}
            {isEnded && <span className="badge bg-neutral-100 text-neutral-500 border border-neutral-200">종료</span>}
          </div>

          <h1 className="text-lg font-bold text-neutral-900">{(session as any).title}</h1>

          <div className="mt-3 space-y-2 text-sm text-neutral-700">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neutral-400" />
              <span className={cn(isPast && 'text-neutral-400')}>{formatKoreanDate(startAt, 'M월 d일 (E)')}</span>

              <Clock className="w-4 h-4 text-neutral-400 ml-2" />
              <span className={cn(isPast && 'text-neutral-400')}>{formatTimeRange(startAt, endAt)}</span>
            </div>

            {/* ✅ 교시별 강의명 + 강사 표시 (1~3교시) */}
<div className="pt-1 space-y-1.5">
  {[1, 2, 3].map((p) => {
    const period = periodMap[p as 1 | 2 | 3];
    const title = String(period?.title ?? '').trim();
    const line = formatInstructorsLine(period?.instructors ?? []);

    return (
      <div key={p} className="flex items-start gap-2">
        <User className="w-4 h-4 text-neutral-400 mt-0.5" />
        <div className="flex-1">
          <div className="text-neutral-800">
            <span className="text-neutral-500 mr-2">{p}교시</span>
            <span className={cn(!title && 'text-neutral-400')}>
              {title || '강의명 미지정'}
            </span>
          </div>
          <div className={cn('text-[13px]', !line ? 'text-neutral-400' : 'text-neutral-500')}>
            {line || '강사 미지정'}
          </div>
        </div>
      </div>
    );
  })}
</div>
          </div>
        </div>

        {/* 바로가기 */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 mb-3">
            <ExternalLink className="w-4 h-4 text-neutral-500" />
            바로가기
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => openLink(videoUrl)}
              disabled={!videoUrl}
              className={cn(
                'w-full rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-between',
                videoUrl ? 'bg-neutral-900 text-white hover:opacity-90' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
              )}
            >
              <span className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                강의 영상 보기
              </span>
              <span className="text-xs opacity-80">{videoUrl ? '열기' : '준비중'}</span>
            </button>

            <button
              type="button"
              onClick={() => openLink(zoomUrl)}
              disabled={!zoomUrl}
              className={cn(
                'w-full rounded-xl px-4 py-3 text-sm flex items-center justify-between',
                zoomUrl ? 'bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-900' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
              )}
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                실시간 강의 참여(Zoom)
              </span>
              <span className="text-xs opacity-70">{zoomUrl ? '열기' : '준비중'}</span>
            </button>

            <button
              type="button"
              onClick={() => openLink(materialsUrl)}
              disabled={!materialsUrl}
              className={cn(
                'w-full rounded-xl px-4 py-3 text-sm flex items-center justify-between',
                materialsUrl
                  ? 'bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-900'
                  : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
              )}
            >
              <span className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                강의 자료 보기
              </span>
              <span className="text-xs opacity-70">{materialsUrl ? '열기' : '준비중'}</span>
            </button>
          </div>

          {!videoUrl && !zoomUrl && !materialsUrl && <p className="mt-3 text-xs text-neutral-500">등록된 자료가 없어요!</p>}
        </div>

        {/* 준비물 */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 mb-2">
            <Package className="w-4 h-4 text-neutral-500" />
            준비물
          </div>
          {(session as any).materials && (session as any).materials.length > 0 ? (
            <p className="text-sm text-neutral-700">{formatMaterials((session as any).materials)}</p>
          ) : (
            <p className="text-sm text-neutral-500">준비물이 없어요.</p>
          )}
        </div>

        {/* 안내/비고 */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 mb-2">
            <Layers className="w-4 h-4 text-neutral-500" />
            안내 / 비고
          </div>
          {(session as any).notes ? (
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{(session as any).notes}</p>
          ) : (
            <p className="text-sm text-neutral-500">추가 안내가 없어요.</p>
          )}
        </div>
      </div>
    </div>
  );
}