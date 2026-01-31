import { TabBar } from '@/components/layout/TabBar';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="page-container">
      {children}
      <TabBar />
    </div>
  );
}
