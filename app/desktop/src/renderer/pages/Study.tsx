import { useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';

const SUBJECTS = [
  { id: 'physics', label: 'Physics' },
  { id: 'math', label: 'Math Analysis' },
];

export function Study() {
  const [activeSubject, setActiveSubject] = useState<string>();

  return (
    <MainLayout
      agent="study"
      sidebar={{
        title: 'Subjects',
        items: SUBJECTS,
        activeId: activeSubject,
        onSelect: setActiveSubject,
      }}
    >
      {activeSubject ? (
        <div>
          <h1 className="text-2xl font-bold mb-4">
            {SUBJECTS.find((s) => s.id === activeSubject)?.label}
          </h1>
          <p className="text-neutral-400">Subject details coming soon</p>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-neutral-500">
          Select a subject
        </div>
      )}
    </MainLayout>
  );
}
