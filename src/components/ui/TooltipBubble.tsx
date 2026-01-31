'use client';

import React from 'react';

type Props = {
  open: boolean;
  anchor?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  title: string;
  description: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  closeLabel?: string;
  storageKey?: string;
  onClose: () => void;
};

export function TooltipBubble({
  open,
  anchor = 'top-right',
  title,
  description,
  primaryLabel,
  onPrimary,
  closeLabel = '닫기',
  storageKey,
  onClose,
}: Props) {
  if (!open) return null;

  const pos =
    anchor === 'top-right'
      ? 'top-16 right-4'
      : anchor === 'top-left'
      ? 'top-16 left-4'
      : anchor === 'bottom-right'
      ? 'bottom-16 right-4'
      : 'bottom-16 left-4';

  const handleClose = () => {
    if (storageKey) localStorage.setItem(storageKey, '1');
    onClose();
  };

  return (
    <div className={`fixed ${pos} z-[9999] w-[320px] max-w-[90vw]`}>
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="mt-1 text-sm text-neutral-600 whitespace-pre-line">{description}</div>

        <div className="mt-3 flex gap-2">
          {primaryLabel && onPrimary && (
            <button
              type="button"
              onClick={onPrimary}
              className="flex-1 px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm hover:opacity-90"
            >
              {primaryLabel}
            </button>
          )}

          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2 rounded-xl bg-white border border-neutral-200 text-sm hover:bg-neutral-50"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}