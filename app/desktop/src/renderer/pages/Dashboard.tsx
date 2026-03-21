import { MainLayout } from '../components/layout/MainLayout';
import { TodayWidget } from '../components/dashboard/TodayWidget';
import { DevWidget } from '../components/dashboard/DevWidget';
import { TeachingWidget } from '../components/dashboard/TeachingWidget';
import { StudyWidget } from '../components/dashboard/StudyWidget';
import { HealthWidget } from '../components/dashboard/HealthWidget';
import { FinanceWidget } from '../components/dashboard/FinanceWidget';

export function Dashboard() {
  return (
    <MainLayout agent="general" defaultChatWidthPct={35}>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

        {/* Today — full width */}
        <div className="mb-6">
          <TodayWidget />
        </div>

        {/* Sphere widgets — adaptive grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <DevWidget />
          <TeachingWidget />
          <StudyWidget />
          <HealthWidget />
          <FinanceWidget />
        </div>
      </div>
    </MainLayout>
  );
}
