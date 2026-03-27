import { MainLayout } from '../components/layout/MainLayout';
import { DevWidget } from '../components/dashboard/DevWidget';
import { TeachingWidget } from '../components/dashboard/TeachingWidget';
import { StudyWidget } from '../components/dashboard/StudyWidget';
import { HealthWidget } from '../components/dashboard/HealthWidget';
import { FinanceWidget } from '../components/dashboard/FinanceWidget';
import { TodayBlock } from '../components/dashboard/TodayBlock';

export function Dashboard() {
  return (
    <MainLayout agent="general" defaultChatWidthPct={30}>
      <div className="overflow-y-auto h-full p-6 space-y-6">
        {/* Today block — events + tasks */}
        <TodayBlock />

        {/* Section widgets grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <TeachingWidget />
          <DevWidget />
          <StudyWidget />
          <FinanceWidget />
          <HealthWidget />
        </div>
      </div>
    </MainLayout>
  );
}
