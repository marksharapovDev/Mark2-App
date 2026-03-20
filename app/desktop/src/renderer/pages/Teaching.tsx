import { useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';

const STUDENTS = [
  { id: 'alex', label: 'Alex Petrov' },
  { id: 'maria', label: 'Maria Ivanova' },
];

export function Teaching() {
  const [activeStudent, setActiveStudent] = useState<string>();

  return (
    <MainLayout
      agent="teaching"
      sidebar={{
        title: 'Students',
        items: STUDENTS,
        activeId: activeStudent,
        onSelect: setActiveStudent,
      }}
    >
      {activeStudent ? (
        <div>
          <h1 className="text-2xl font-bold mb-4">
            {STUDENTS.find((s) => s.id === activeStudent)?.label}
          </h1>
          <p className="text-neutral-400">Student details coming soon</p>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-neutral-500">
          Select a student
        </div>
      )}
    </MainLayout>
  );
}
