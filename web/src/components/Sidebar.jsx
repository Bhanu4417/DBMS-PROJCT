import { useEffect, useState } from 'react';
import { NavLink } from '../navigation';
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Settings,
  UserCheck,
  Users,
} from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/students', label: 'Students', icon: GraduationCap },
  { to: '/faculty', label: 'Faculty', icon: Users },
  { to: '/departments', label: 'Departments', icon: Building2 },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/semesters', label: 'Semesters', icon: CalendarDays },
  { to: '/offerings', label: 'Course Offerings', icon: Layers },
  { to: '/assignments', label: 'Faculty Assignments', icon: UserCheck },
  { to: '/enrollments', label: 'Enrollments', icon: ClipboardList },
  { to: '/grades', label: 'Grades', icon: Award },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 hidden shrink-0 flex-col border-r border-line bg-panel transition-all duration-200 md:flex ${
        collapsed ? 'w-[76px]' : 'w-[248px]'
      }`}
    >
      <div className={`flex items-center gap-2.5 px-5 py-5 ${collapsed ? 'justify-center px-0' : ''}`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <GraduationCap size={20} />
        </span>
        {!collapsed && (
          <div className="brand-text leading-tight">
            <p className="text-sm font-bold tracking-wide text-ink">
              shoptaker<span className="text-muted"> / college</span>
            </p>
            <p className="text-[11px] text-muted">College administration</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {!collapsed && <p className="nav-section px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted/70">Manage</p>}
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                isActive
                  ? 'bg-accent/10 text-ink'
                  : 'text-muted hover:bg-soft hover:text-ink'
              } ${collapsed ? 'justify-center px-0' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? 'text-accent' : 'text-muted group-hover:text-ink'} />
                {!collapsed && <span className="nav-label font-medium">{label}</span>}
                {!collapsed && isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        {!collapsed && (
          <p className="mb-2 rounded-lg border border-line bg-soft px-2.5 py-2 text-[10px] leading-relaxed text-muted">
            Local administrative demo — no login required. All data lives in SQLite.
          </p>
        )}
        <button
          type="button"
          onClick={onToggle}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-xs text-muted transition hover:bg-soft hover:text-ink ${
            collapsed ? 'px-0' : ''
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('campusos-sidebar') === '1');
  useEffect(() => {
    localStorage.setItem('campusos-sidebar', collapsed ? '1' : '0');
  }, [collapsed]);
  return { collapsed, toggle: () => setCollapsed((value) => !value) };
}
