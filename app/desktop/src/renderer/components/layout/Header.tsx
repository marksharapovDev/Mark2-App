import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Dashboard' },
  { to: '/dev', label: 'Dev' },
  { to: '/teaching', label: 'Teaching' },
  { to: '/study', label: 'Study' },
  { to: '/health', label: 'Health' },
  { to: '/finance', label: 'Finance' },
] as const;

export function Header() {
  return (
    <header className="h-11 shrink-0 border-b border-neutral-800 flex items-center px-4 gap-1 bg-neutral-950">
      <span className="text-sm font-bold tracking-tight mr-4 text-neutral-300">Mark2</span>

      {TABS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `px-3 py-1 rounded text-xs font-medium transition-colors ${
              isActive
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-500 hover:text-neutral-300'
            }`
          }
        >
          {label}
        </NavLink>
      ))}

      <div className="ml-auto flex items-center gap-1">
        <NavLink
          to="/calendar"
          className={({ isActive }) =>
            `p-1.5 rounded transition-colors ${
              isActive ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
            }`
          }
          title="Calendar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `p-1.5 rounded transition-colors ${
              isActive ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
            }`
          }
          title="Settings"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </NavLink>
      </div>
    </header>
  );
}
