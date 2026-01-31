'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { SimpleFilterChips } from '@/components/ui/FilterChips';
import { EmptyState } from '@/components/ui/EmptyState';
import { CheckCircle, XCircle, FileText, AlertTriangle, Award } from 'lucide-react';
import { cn, formatKoreanDate, getRegionColor, getLevelColor } from '@/lib/utils';
import { ELIGIBILITY_CONFIG, ENCOURAGEMENT_MESSAGES } from '@/lib/constants';
import type { AttendanceRecord, Session, EligibilityStatus, Favorite } from '@/types';

interface AttendanceContentProps {
  attendance: (AttendanceRecord & { session: Session })[];
  eligibility: EligibilityStatus | null;
  favorites: Favorite[];
}

export function AttendanceContent({ attendance, eligibility, favorites }: AttendanceContentProps) {
  const [filter, setFilter] = useState<'all' | 'attended' | 'missed'>('all');

  // 필터링
  const filteredAttendance = useMemo(() => {
    return attendance.filter(record => {
      switch (filter) {
        case 'attended':
          return record.attended;
        case 'missed':
          return !record.attended;
        default:
          return true;
      }
    });
  }, [attendance, filter]);

  // 통계
  const stats = useMemo(() => {
    const total = attendance.length;
    const attended = attendance.filter(r => r.attended).length;
    const homeworkDone = attendance.filter(r => r.homework_submitted).length;
    
    return {
      total,
      attended,
      missed: total - attended,
      homeworkDone,
      homeworkMissing: total - homeworkDone,
      attendanceRate: total > 0 ? Math.round((attended / total) * 100) : 0,
      homeworkRate: total > 0 ? Math.round((homeworkDone / total) * 100) : 0,
    };
  }, [attendance]);

  // 자격 상태 확인
  const isEligible = eligibility?.eligibility === 'eligible';
  const needsAttention = 
    stats.missed >= ELIGIBILITY_CONFIG.MAX_ABSENCES - 1 ||
    stats.homeworkMissing >= ELIGIBILITY_CONFIG.MAX_HOMEWORK_MISSING - 1;

  // 응원 메시지 선택
  const encouragementMessage = useMemo(() => {
    if (!isEligible) {
      return ENCOURAGEMENT_MESSAGES.NOT_ELIGIBLE[
        Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.NOT_ELIGIBLE.length)
      ];
    }
    if (stats.missed > 0) {
      return ENCOURAGEMENT_MESSAGES.ABSENCE[
        Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.ABSENCE.length)
      ];
    }
    if (stats.homeworkMissing > 0) {
      return ENCOURAGEMENT_MESSAGES.HOMEWORK[
        Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.HOMEWORK.length)
      ];
    }
    return null;
  }, [isEligible, stats]);

  return (
    <>
      <Header title="출석/과제" />

      {/* 통계 카드 */}
      <div className="px-4 py-4 space-y-4">
        {/* 출석률 */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-neutral-900">출석 현황</h3>
            <span className={cn(
              'text-2xl font-bold',
              stats.attendanceRate >= 80 ? 'text-secondary-500' :
              stats.attendanceRate >= 50 ? 'text-amber-500' : 'text-red-500'
            )}>
              {stats.attendanceRate}%
            </span>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-secondary-500" />
              <span className="text-neutral-600">출석 {stats.attended}회</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-neutral-600">결석 {stats.missed}회</span>
            </div>
          </div>
          {/* 진행 바 */}
          <div className="mt-3 h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-secondary-500 transition-all"
              style={{ width: `${stats.attendanceRate}%` }}
            />
          </div>
        </div>

        {/* 과제 현황 */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-neutral-900">과제 현황</h3>
            <span className={cn(
              'text-2xl font-bold',
              stats.homeworkRate >= 80 ? 'text-secondary-500' :
              stats.homeworkRate >= 50 ? 'text-amber-500' : 'text-red-500'
            )}>
              {stats.homeworkRate}%
            </span>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-secondary-500" />
              <span className="text-neutral-600">제출 {stats.homeworkDone}회</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-500" />
              <span className="text-neutral-600">미제출 {stats.homeworkMissing}회</span>
            </div>
          </div>
          <div className="mt-3 h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-secondary-500 transition-all"
              style={{ width: `${stats.homeworkRate}%` }}
            />
          </div>
        </div>

        {/* 자격 상태 배너 */}
        {eligibility && (
          <div className={cn(
            'banner',
            isEligible ? 'banner-success' : 'banner-error'
          )}>
            {isEligible ? (
              <Award className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            )}
            <div>
              <p className="font-medium">
                {isEligible ? '시험 응시 자격 충족!' : '시험 응시 자격 미달'}
              </p>
              {eligibility.reason && (
                <p className="text-sm opacity-80 mt-0.5">{eligibility.reason}</p>
              )}
            </div>
          </div>
        )}

        {/* 응원 메시지 */}
        {encouragementMessage && (needsAttention || !isEligible) && (
          <div className="banner banner-warning">
            <span className="text-xl">💪</span>
            <p className="text-sm">{encouragementMessage}</p>
          </div>
        )}
      </div>

      {/* 필터 */}
      <div className="px-4 py-2 bg-white border-b border-neutral-100">
        <SimpleFilterChips
          options={['출석', '결석']}
          selected={
            filter === 'attended' ? '출석' :
            filter === 'missed' ? '결석' : null
          }
          onChange={(value) => {
            if (value === '출석') setFilter('attended');
            else if (value === '결석') setFilter('missed');
            else setFilter('all');
          }}
        />
      </div>

      {/* 출석 기록 리스트 */}
      <main className="px-4 py-4">
        {filteredAttendance.length === 0 ? (
          <EmptyState
            emoji="📋"
            title="출석 기록이 없습니다"
            description="아직 기록된 출석 내역이 없습니다"
          />
        ) : (
          <div className="space-y-3">
            {filteredAttendance.map((record) => (
              <div key={record.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* 세션 정보 */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={cn('badge text-xs', getRegionColor(record.session.region))}>
                        {record.session.region}
                      </span>
                      <span className={cn('badge text-xs', getLevelColor(record.session.level))}>
                        {record.session.level}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {record.session.session_no}회차
                      </span>
                    </div>
                    
                    <h4 className="text-sm font-medium text-neutral-900 mb-1">
                      {record.session.title}
                    </h4>
                    <p className="text-xs text-neutral-500">
                      {formatKoreanDate(record.session.start_at, 'M월 d일 (E)')}
                    </p>
                  </div>

                  {/* 출석/과제 상태 */}
                  <div className="flex flex-col items-end gap-2">
                    <div className={cn(
                      'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded',
                      record.attended 
                        ? 'bg-secondary-50 text-secondary-700' 
                        : 'bg-red-50 text-red-700'
                    )}>
                      {record.attended ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      {record.attended ? '출석' : '결석'}
                    </div>
                    
                    <div className={cn(
                      'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded',
                      record.homework_submitted 
                        ? 'bg-secondary-50 text-secondary-700' 
                        : 'bg-amber-50 text-amber-700'
                    )}>
                      <FileText className="w-3.5 h-3.5" />
                      {record.homework_submitted ? '과제 제출' : '과제 미제출'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
