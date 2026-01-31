// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '해피니언 아카데미',
  description: '해피니언 아카데미 강의 관리 시스템',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '해피니언',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="min-h-dvh">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>

      {/* ✅ overflow-x-hidden: 가로 삐져나오는 요소를 전역에서 차단 */}
      <body className="min-h-dvh bg-neutral-50 overflow-x-hidden">
        {/* ✅ 모바일 기준 컨테이너: 모든 페이지 폭 통일 */}
        <div className="mx-auto w-full max-w-lg sm:max-w-xl md:max-w-3xl px-4">
          {children}
        </div>
      </body>
    </html>
  );
}