'use client';

import React from 'react'
import { cn } from '@/lib/utils';

export function EmptyState({
  message,
  emoji = '📭',
  className,
  children,
}: {
  message: string;
  emoji?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'py-16 flex flex-col items-center justify-center text-center',
        className
      )}
    >
      {/* 아이콘(가볍게) */}
      <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
        <span className="text-xl">{emoji}</span>
      </div>

      {/* 메시지 */}
      <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line">
        {message}
      </p>

      {/* 아래에 버튼 같은거 넣고 싶을 때 */}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}