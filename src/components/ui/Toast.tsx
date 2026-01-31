'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

export function Toast({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 1800);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        // ✅ 여기만 핵심: bottom-4 → top-16(또는 top-4)
        'fixed left-1/2 top-16 z-[9999] -translate-x-1/2',
        'rounded-xl bg-neutral-900 text-white px-4 py-2 text-sm shadow-lg'
      )}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}