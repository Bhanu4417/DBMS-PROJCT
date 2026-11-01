import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { GraduationCap, X } from 'lucide-react';
import Sidebar, { NAV_ITEMS, useSidebarState } from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useTheme } from '../hooks/useTheme';

export default function AppLayout() {
  const { collapsed, toggle } = useSidebarState();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar collapsed={collapsed} onToggle={toggle} />

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-line bg-panel p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-ink">
                <GraduationCap size={18} className="text-accent" /> CAMPUS
                <span className="-ml-2 text-accent">OS</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-muted hover:text-ink"
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                      isActive ? 'bg-accent/15 text-ink' : 'text-muted hover:bg-soft hover:text-ink'
                    }`
                  }
                >
                  <Icon size={17} />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className={`transition-all duration-200 ${collapsed ? 'md:pl-[76px]' : 'md:pl-[248px]'}`}>
        <Topbar theme={theme} onToggleTheme={toggleTheme} onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <footer className="mx-auto w-full max-w-[1500px] px-4 pb-8 text-xs text-muted sm:px-6 lg:px-8">
          CampusOS · College Management System · data served live from PostgreSQL through FastAPI
        </footer>
      </div>
    </div>
  );
}
