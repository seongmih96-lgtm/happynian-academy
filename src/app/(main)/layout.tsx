import { TabBar } from '@/components/layout/TabBar';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-neutral-50 overflow-x-hidden">
      {/* ✅ 모바일 기준 메인 컨테이너 */}
      <div className="mx-auto w-full max-w-md sm:max-w-xl md:max-w-3xl px-4 pb-24">
        {children}
      </div>

      {/* ✅ 하단 고정 탭바 */}
      <TabBar />
    </div>
  );
}