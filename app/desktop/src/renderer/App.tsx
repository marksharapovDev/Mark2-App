import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/dev', label: 'Dev' },
  { to: '/teaching', label: 'Teaching' },
  { to: '/study', label: 'Study' },
  { to: '/health', label: 'Health' },
  { to: '/finance', label: 'Finance' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/chat', label: 'Chat' },
  { to: '/settings', label: 'Settings' },
] as const;

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <h2 className="text-2xl text-neutral-400">{title}</h2>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <div className="flex h-screen bg-neutral-950 text-neutral-100">
        <nav className="w-52 shrink-0 border-r border-neutral-800 p-4 flex flex-col gap-1">
          <span className="text-lg font-bold mb-4 tracking-tight">Mark2</span>
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dev" element={<Placeholder title="Dev" />} />
            <Route path="/teaching" element={<Placeholder title="Teaching" />} />
            <Route path="/study" element={<Placeholder title="Study" />} />
            <Route path="/health" element={<Placeholder title="Health" />} />
            <Route path="/finance" element={<Placeholder title="Finance" />} />
            <Route path="/calendar" element={<Placeholder title="Calendar" />} />
            <Route path="/chat" element={<Placeholder title="Chat" />} />
            <Route path="/settings" element={<Placeholder title="Settings" />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
