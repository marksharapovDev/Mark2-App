export interface SidebarItem {
  id: string;
  label: string;
}

interface SidebarProps {
  title: string;
  items: SidebarItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
}

export function Sidebar({ title, items, activeId, onSelect }: SidebarProps) {
  return (
    <aside className="w-48 shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50">
      <div className="px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
        {title}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect?.(item.id)}
            className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
              activeId === item.id
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
