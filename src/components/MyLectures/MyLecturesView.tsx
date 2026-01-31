'use client';

import React, { useMemo } from 'react';
import { cn, formatKoreanDate, formatTimeRange } from '@/lib/utils';
import { ChevronDown, ExternalLink, Users, CheckCircle2, AlertTriangle, ClipboardCopy } from 'lucide-react';
import type { ResourceTab } from '@/hooks/useMyLecturesHub';

type Props = {
  hub: any;
};

function KpiCard({ title, value, sub }: any) {
  return (
    <div className="bg-white border border-neutral-100 rounded-2xl p-4">
      <div className="text-xs text-neutral-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options }: any) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-600">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm"
        >
          {options.map((o: string) => (
            <option key={o} value={o}>
              {o === 'all' ? '전체' : o}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </label>
  );
}

export default function MyLecturesView({ hub }: Props) {
  const {
    loading,
    rows,

    region,
    setRegion,
    level,
    setLevel,
    sessionNo,
    setSessionNo,
    regionOptions,
    levelOptions,
    sessionNoOptions,

    expandedId,
    detailMap,
    detailLoadingId,
    toggleExpand,
    getTodoLists,

    getUrl,
    openUrl,

    kpi,
  } = hub;

  const copyList = async (title: string, names: string[]) => {
    try {
      const text = `${title}\n` + names.map((n) => `- ${n}`).join('\n');
      await navigator.clipboard.writeText(text);
      alert('복사 완료!');
    } catch {
      alert('복사 실패(브라우저 권한 확인)');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="sticky top-0 z-20 bg-neutral-50/90 backdrop-blur border-b border-neutral-100">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <div className="text-sm font-semibold text-neutral-900">내 강의</div>
          <div className="text-xs text-neutral-500 mt-1">
            내 이름과 강사명이 일치하는 강의만 자동으로 모았어요 ✨
          </div>

          {/* KPI */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <KpiCard title="이번달 내 강의 갯수" value={`${kpi?.monthCount ?? 0}개`} sub="(이번달 기준)" />
            <KpiCard title="내 강의를 듣는 수강생 수" value={`${kpi?.studentCount ?? 0}명`} sub="(펼쳐본 강의 기준 집계)" />
            <KpiCard title="내 강의 총 출석률" value={`${kpi?.attendanceRate ?? 0}%`} sub="(펼쳐본 강의 기준 집계)" />
            <KpiCard title="내 강의 총 과제제출률" value={`${kpi?.homeworkRate ?? 0}%`} sub="(펼쳐본 강의 기준 집계)" />
          </div>

          {/* Filters */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Select label="지역" value={region} onChange={setRegion} options={regionOptions} />
            <Select label="과정" value={level} onChange={setLevel} options={levelOptions} />
            <Select label="회차" value={sessionNo} onChange={setSessionNo} options={sessionNoOptions} />
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-sm text-neutral-500 py-10 text-center">불러오는 중...</div>
        ) : (rows?.length ?? 0) === 0 ? (
          <div className="text-sm text-neutral-500 py-10 text-center">내 강의가 아직 없어요.</div>
        ) : (
          rows.map((s: any) => {
            const isOpen = expandedId === s.id;
            const d = detailMap?.[s.id];

            const urlVideo = getUrl(s, 'video' as ResourceTab);
            const urlZoom = getUrl(s, 'zoom' as ResourceTab);
            const urlMat = getUrl(s, 'materials' as ResourceTab);

            const { absentIds, homeworkMissingIds } = getTodoLists(s.id);

            const nameMap = d?.nameMap ?? {};
            const absentNames = absentIds.map((id: string) => nameMap[id] ?? id);
            const hwMissingNames = homeworkMissingIds.map((id: string) => nameMap[id] ?? id);

            const enrolledNames = (d?.enrolledIds ?? []).map((id: string) => nameMap[id] ?? id);
            const attendNames = (d?.attendanceIds ?? []).map((id: string) => nameMap[id] ?? id);
            const hwNames = (d?.homeworkIds ?? []).map((id: string) => nameMap[id] ?? id);

            const attendanceRate =
              d?.enrolledIds?.length ? Math.round((d.attendanceIds.length / d.enrolledIds.length) * 100) : 0;
            const homeworkRate =
              d?.enrolledIds?.length ? Math.round((d.homeworkIds.length / d.enrolledIds.length) * 100) : 0;

            return (
              <section key={s.id} className="bg-white border border-neutral-100 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 truncate">{s.title}</div>
                    <div className="mt-2 text-xs text-neutral-500">
                      <span className="mr-2">{formatKoreanDate(s.start_at)}</span>
                      <span className="text-neutral-300">·</span>
                      <span className="ml-2">{formatTimeRange(s.start_at, s.end_at)}</span>
                      {s.region ? <span className="ml-2 text-neutral-300">·</span> : null}
                      {s.region ? <span className="ml-2">{s.region}</span> : null}
                      {s.level ? <span className="ml-2 text-neutral-300">·</span> : null}
                      {s.level ? <span className="ml-2">{s.level}</span> : null}
                      {s.session_no != null ? <span className="ml-2 text-neutral-300">·</span> : null}
                      {s.session_no != null ? <span className="ml-2">{s.session_no}회차</span> : null}
                    </div>

                    {/* quick stats */}
                    {d && (
                      <div className="mt-3 flex items-center gap-3 text-xs text-neutral-700">
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-4 h-4" /> 수강생 {d.enrolledIds.length}명
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> 출석 {attendanceRate}%
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> 과제 {homeworkRate}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleExpand(s.id)}
                      className={cn(
                        'px-3 py-2 rounded-xl border text-sm flex items-center gap-2',
                        isOpen
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                      )}
                    >
                      {isOpen ? '접기' : '펼쳐보기'}
                    </button>

                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => openUrl(urlVideo)}
                        disabled={!urlVideo}
                        className={cn(
                          'px-3 py-2 rounded-xl text-sm flex items-center gap-2',
                          urlVideo ? 'bg-neutral-900 text-white hover:opacity-90' : 'bg-neutral-100 text-neutral-400'
                        )}
                      >
                        <ExternalLink className="w-4 h-4" /> 영상
                      </button>

                      <button
                        type="button"
                        onClick={() => openUrl(urlZoom)}
                        disabled={!urlZoom}
                        className={cn(
                          'px-3 py-2 rounded-xl text-sm flex items-center gap-2',
                          urlZoom ? 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50' : 'bg-neutral-100 text-neutral-400'
                        )}
                      >
                        <ExternalLink className="w-4 h-4" /> 줌
                      </button>

                      <button
                        type="button"
                        onClick={() => openUrl(urlMat)}
                        disabled={!urlMat}
                        className={cn(
                          'px-3 py-2 rounded-xl text-sm flex items-center gap-2',
                          urlMat ? 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50' : 'bg-neutral-100 text-neutral-400'
                        )}
                      >
                        <ExternalLink className="w-4 h-4" /> 자료
                      </button>
                    </div>
                  </div>
                </div>

                {/* expanded */}
                {isOpen && (
                  <div className="mt-4 border-t border-neutral-100 pt-4">
                    {detailLoadingId === s.id && (
                      <div className="text-sm text-neutral-500 py-4">세부정보 불러오는 중...</div>
                    )}

                    {d && (
                      <div className="space-y-4">
                        {/* 해야 할 사람 */}
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-amber-900 inline-flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" />
                              해야 할 사람
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => copyList('미출석자', absentNames)}
                                className="text-xs px-3 py-2 rounded-xl bg-white border border-amber-200 text-amber-900 hover:bg-amber-100"
                              >
                                <ClipboardCopy className="w-4 h-4 inline-block mr-1" />
                                미출석 복사
                              </button>
                              <button
                                type="button"
                                onClick={() => copyList('과제 미제출자', hwMissingNames)}
                                className="text-xs px-3 py-2 rounded-xl bg-white border border-amber-200 text-amber-900 hover:bg-amber-100"
                              >
                                <ClipboardCopy className="w-4 h-4 inline-block mr-1" />
                                미제출 복사
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-3">
                            <div>
                              <div className="text-xs font-semibold text-amber-900">출석 체크 안 한 사람 ({absentNames.length})</div>
                              <div className="mt-1 text-xs text-amber-900/80 whitespace-pre-wrap">
                                {absentNames.length ? absentNames.join(', ') : '없음 ✅'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-amber-900">과제 미제출자 ({hwMissingNames.length})</div>
                              <div className="mt-1 text-xs text-amber-900/80 whitespace-pre-wrap">
                                {hwMissingNames.length ? hwMissingNames.join(', ') : '없음 ✅'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 전체 리스트 */}
                        <div className="grid grid-cols-1 gap-3">
                          <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                            <div className="text-sm font-semibold text-neutral-900">수강생 리스트 ({enrolledNames.length})</div>
                            <div className="mt-2 text-xs text-neutral-600 whitespace-pre-wrap">
                              {enrolledNames.length ? enrolledNames.join(', ') : '없음'}
                            </div>
                          </div>

                          <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                            <div className="text-sm font-semibold text-neutral-900">출석 체크한 사람 ({attendNames.length})</div>
                            <div className="mt-2 text-xs text-neutral-600 whitespace-pre-wrap">
                              {attendNames.length ? attendNames.join(', ') : '없음'}
                            </div>
                          </div>

                          <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                            <div className="text-sm font-semibold text-neutral-900">과제 제출한 사람 ({hwNames.length})</div>
                            <div className="mt-2 text-xs text-neutral-600 whitespace-pre-wrap">
                              {hwNames.length ? hwNames.join(', ') : '없음'}
                            </div>
                          </div>
                        </div>

                        {/* (나중에) 원클릭 리마인드 자리 */}
                        <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-4">
                          <div className="text-sm font-semibold text-neutral-900">원클릭 리마인드(다음 단계)</div>
                          <div className="mt-1 text-xs text-neutral-500">
                            나중에 알림톡 연동하면, 여기서 “미출석/미제출자에게 한번에 보내기” 버튼 넣으면 돼.
                          </div>
                        </div>
                      </div>
                    )}
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