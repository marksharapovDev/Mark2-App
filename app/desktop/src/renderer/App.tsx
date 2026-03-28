import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { CalendarProvider } from './context/calendar-context';
import { TimerProvider } from './context/timer-context';
import { SidebarProvider } from './context/sidebar-context';
import { Dashboard } from './pages/Dashboard';
import { Dev } from './pages/Dev';
import { Teaching } from './pages/Teaching';
import { Study } from './pages/Study';
import { Health } from './pages/Health';
import { Finance } from './pages/Finance';
import { Calendar } from './pages/Calendar';
import { Settings } from './pages/Settings';
import { ChatPopout } from './pages/ChatPopout';
import { CalendarPopout } from './pages/CalendarPopout';
import { TimerPopout } from './pages/TimerPopout';

function AppRoutes() {
  const location = useLocation();
  const isPopout = location.pathname.startsWith('/chat-popout')
    || location.pathname.startsWith('/calendar-popout')
    || location.pathname.startsWith('/timer-popout');

  // Popout window: no header, no chrome — just the content
  if (isPopout) {
    return (
      <Routes>
        <Route path="/chat-popout/:agent" element={<ChatPopout />} />
        <Route path="/calendar-popout" element={<CalendarPopout />} />
        <Route path="/timer-popout" element={<TimerPopout />} />
      </Routes>
    );
  }

  // Main window: full layout
  return (
    <CalendarProvider>
      <TimerProvider>
        <SidebarProvider>
          <div className="flex flex-col h-screen bg-neutral-950 text-neutral-100">
            <Header />
            <div className="flex flex-1 overflow-hidden">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dev" element={<Dev />} />
                <Route path="/teaching" element={<Teaching />} />
                <Route path="/study" element={<Study />} />
                <Route path="/health" element={<Health />} />
                <Route path="/finance" element={<Finance />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
          </div>
        </SidebarProvider>
      </TimerProvider>
    </CalendarProvider>
  );
}

export function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
