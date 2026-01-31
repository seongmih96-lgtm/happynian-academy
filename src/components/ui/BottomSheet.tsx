'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string; // ✅ 추가
  children: React.ReactNode;
  maxWidthClassName?: string; // 필요하면 확장
};

export function BottomSheet({
  open,
  onClose,
  title,
  description, // ✅ 추가
  children,
  maxWidthClassName = 'max-w-3xl',
}: Props) {
  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 바디 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* overlay */}
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />

      {/* sheet */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center">
        <div
          className={cn(
            'w-full',
            maxWidthClassName,
            'bg-white rounded-t-3xl shadow-2xl border border-neutral-200',
            'animate-[sheetUp_180ms_ease-out]',
            'max-h-[85vh] overflow-hidden'
          )}
        >
          {/* header */}
          <div className="px-4 pt-3 pb-2 border-b border-neutral-100">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-neutral-200" />

            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-900">
                  {title ?? ''}
                </div>
                {description ? (
                  <div className="mt-1 text-xs text-neutral-500">{description}</div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* content */}
          <div className="px-4 py-4 overflow-y-auto max-h-[calc(85vh-64px)]">
            {children}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes sheetUp {
          from {
            transform: translateY(16px);
            opacity: 0.7;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}