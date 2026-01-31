'use client';

import { X } from 'lucide-react';

export default function VideoPlayerModal({
  open,
  title,
  url,
  onClose,
  onEnded,
}: {
  open: boolean;
  title?: string;
  url: string;
  onClose: () => void;
  onEnded: () => void;
}) {
  if (!open) return null;

  const isMp4 = /\.mp4(\?|$)/i.test(url);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="text-sm font-semibold text-neutral-900">{title ?? '강의영상'}</div>
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-neutral-100"
            onClick={onClose}
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-black">
          {isMp4 ? (
            <video
              src={url}
              controls
              autoPlay
              className="w-full max-h-[70vh]"
              onEnded={onEnded}
            />
          ) : (
            <iframe
              src={url}
              className="w-full h-[70vh]"
              allow="autoplay; fullscreen; picture-in-picture"
            />
          )}
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onEnded}
            className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm hover:opacity-90"
          >
            시청 완료 처리
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl border border-neutral-200 text-sm hover:bg-neutral-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}