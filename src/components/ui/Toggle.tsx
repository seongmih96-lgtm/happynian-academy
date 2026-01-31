'use client';

import { useEffect } from 'react';

interface ToastProps {
  open: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  durationMs?: number; // 기본 2500
}

export function Toast({
  open,
  message,
  actionLabel,
  onAction,
  onClose,
  durationMs = 2500,
}: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => onClose(), durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div className="fixed left-1/2 top-4 z-[9999] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <div className="text-sm text-neutral-800">{message}</div>

        <div className="flex items-center gap-2">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={() => {
                onAction();
                onClose();
              }}
              className="text-sm font-semibold text-neutral-900 hover:opacity-80"
            >
              {actionLabel}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:opacity-80"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}