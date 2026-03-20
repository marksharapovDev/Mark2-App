import type { ReactNode } from 'react';
import { Sidebar, type SidebarItem } from './Sidebar';
import { ChatPanel } from './ChatPanel';

type AgentName = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'general';

interface MainLayoutProps {
  agent: AgentName;
  children: ReactNode;
  sidebar?: {
    title: string;
    items: SidebarItem[];
    activeId?: string;
    onSelect?: (id: string) => void;
  };
  showChat?: boolean;
}

export function MainLayout({ agent, children, sidebar, showChat = true }: MainLayoutProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {sidebar && (
        <Sidebar
          title={sidebar.title}
          items={sidebar.items}
          activeId={sidebar.activeId}
          onSelect={sidebar.onSelect}
        />
      )}

      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>

      {showChat && <ChatPanel agent={agent} />}
    </div>
  );
}
