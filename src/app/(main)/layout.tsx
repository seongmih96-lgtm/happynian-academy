import { TabBar } from '@/components/layout/TabBar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-50">
      {/* ✅ 모바일 폭 통일 컨테이너 (여기서만 관리) */}
      <div className="mx-auto w-full max-w-md sm:max-w-xl md:max-w-3xl px-4 pb-24">
        {children}
      </div>

      {/* ✅ 하단 탭바 */}
      <TabBar />
    </div>
  );
}