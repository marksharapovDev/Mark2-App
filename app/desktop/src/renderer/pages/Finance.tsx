import { useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';

const SECTIONS = [
  { id: 'expenses', label: 'Expenses' },
  { id: 'income', label: 'Income' },
  { id: 'budget', label: 'Budget' },
  { id: 'analytics', label: 'Analytics' },
];

export function Finance() {
  const [activeSection, setActiveSection] = useState<string>('expenses');

  return (
    <MainLayout
      agent="finance"
      sidebar={{
        title: 'Finance',
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
