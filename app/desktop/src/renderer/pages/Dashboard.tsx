import { MainLayout } from '../components/layout/MainLayout';
import { DevWidget } from '../components/dashboard/DevWidget';
import { TeachingWidget } from '../components/dashboard/TeachingWidget';
import { StudyWidget } from '../components/dashboard/StudyWidget';
import { HealthWidget } from '../components/dashboard/HealthWidget';
import { FinanceWidget } from '../components/dashboard/FinanceWidget';
import { TodayPanel } from '../components/dashboard/TodayPanel';

export function Dashboard() {
  return (
    <MainLayout agent="general" defaultChatWidthPct={30}>
      <div className="flex h-full overflow-hidden">
        {/* Left column — sphere widgets */}
        <div className="flex-[3] overflow-y-auto p-6 space-y-4">
          <TeachingWidget />
          <DevWidget />
          <StudyWidget />
          <FinanceWidget />
          <HealthWidget />
        </div>

        {/* Divider */}
        <div className="w-px bg-neutral-800 shrink-0" />

        {/* Right column — today tasks */}
        <div className="flex-[2] overflow-y-auto">
          <TodayPanel />
        </div>
      </div>
    </MainLayout>
  );
}
