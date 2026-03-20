import { useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';

const SECTIONS = [
  { id: 'workouts', label: 'Workouts' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'stats', label: 'Statistics' },
];

export function Health() {
  const [activeSection, setActiveSection] = useState<string>('workouts');

  return (
    <MainLayout
      agent="health"
      sidebar={{
        title: 'Health',
        items: SECTIONS,
        activeId: activeSection,
        onSelect: setActiveSection,
      }}
    >
      <h1 className="text-2xl font-bold mb-4">
        {SECTIONS.find((s) => s.id === activeSection)?.label}
      </h1>
      <p className="text-neutral-400">Coming soon</p>
    </MainLayout>
  );
}
