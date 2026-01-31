'use client';

import { useEffect, useRef } from 'react';

interface TooltipBubbleProps {
  open: boolean;
  anchor: 'top-right' | 'top-left';
  title: string;
  description: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  closeLabel?: string;
  onClose: () => void;
  storageKey?: string; // 있으면 "다시 안 보기" 저장
}

export function TooltipBubble({
  open,
  anchor,
  title,
  description,
  primaryLabel,
  onPrimary,
  closeLabel = '알겠어요',
  onClose,
  storageKey,
}: TooltipBubbleProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const el = boxRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onClose();
    };

    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onClose]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const position =
    anchor === 'top-right'
      ? 'right-3 top-14'
      : 'left-3 top-14';

  return (
    <div className={`fixed z-[9999] ${position}`}>
      <div
        ref={boxRef}
        className="w-[280px] rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
        role="dialog"
        aria-label="도움말"
      >
        {/* 꼬리 */}
        <div
          className={`absolute -top-2 ${
            anchor === 'top-right' ? 'right-6' : 'left-6'
          } h-4 w-4 rotate-45 border-l border-t border-neutral-200 bg-white`}
        />

        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="mt-1 text-sm text-neutral-600 whitespace-pre-line">
          {description}
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          {primaryLabel && onPrimary && (
            <button
              type="button"
              onClick={() => {
                onPrimary();
                if (storageKey) localStorage.setItem(storageKey, '1');
                onClose();
              }}
              className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs hover:opacity-90"
            >
              {primaryLabel}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (storageKey) localStorage.setItem(storageKey, '1');
              onClose();
            }}
            className="px-3 py-2 rounded-xl bg-white border border-neutral-200 text-xs hover:bg-neutral-50"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}