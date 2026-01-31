'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  /** 기존 방식 */
  message?: string;

  /** 지금 AttendanceContent에서 쓰는 방식 */
  title?: string;
  description?: string;

  /** 공통 */
  emoji?: string;
  className?: string;
  children?: React.ReactNode;
};

export function EmptyState({
  message,
  title,
  description,
  emoji = '📭',
  className,
  children,
}: EmptyStateProps) {
  // 우선순위: title/description 있으면 그걸로, 없으면 message 사용
  const finalTitle = title ?? (message ? undefined : '비어 있어요');
  const finalDescription = description ?? message ?? '';

  return (
    <div
      className={cn(
        'py-16 flex flex-col items-center justify-center text-center',
        className
      )}
    >
      {/* 아이콘 */}
      <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
        <span className="text-xl">{emoji}</span>
      </div>

      {/* 타이틀 (있을 때만) */}
      {finalTitle ? (
        <h3 className="text-sm font-semibold text-neutral-900 mb-1">
          {finalTitle}
        </h3>
      ) : null}

      {/* 설명/메시지 */}
      {finalDescription ? (
        <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line">
          {finalDescription}
        </p>
      ) : null}

      {/* 아래 버튼/액션 */}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}