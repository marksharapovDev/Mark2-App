import { useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';

const PROJECTS = [
  { id: 'li-group', label: 'LI Group' },
  { id: 'my-site', label: 'Personal Site' },
  { id: 'mark2', label: 'Mark2' },
];

export function Dev() {
  const [activeProject, setActiveProject] = useState<string>();

  return (
    <MainLayout
      agent="dev"
      sidebar={{
        title: 'Projects',
        items: PROJECTS,
        activeId: activeProject,
        onSelect: setActiveProject,
      }}
    >
      {activeProject ? (
        <div>
          <h1 className="text-2xl font-bold mb-4">
            {PROJECTS.find((p) => p.id === activeProject)?.label}
          </h1>
          <p className="text-neutral-400">Project details coming soon</p>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-neutral-500">
          Select a project
        </div>
      )}
    </MainLayout>
  );
}
