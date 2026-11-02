import { useState } from 'react';
import { Link, useLocation, useNavigate } from '../navigation';
import { Menu, Moon, Search, Sun, UserRound } from 'lucide-react';
import { NAV_ITEMS } from './Sidebar';

function currentTitle(pathname) {
  if (pathname === '/') return 'Dashboard';
  const match = NAV_ITEMS.find((item) => item.to !== '/' && pathname.startsWith(item.to));
  if (match) {
    if (pathname.split('/').length > 2) return `${match.label} details`;
    return match.label;
  }
  return 'CampusOS';
}

export default function Topbar({ theme, onToggleTheme, onOpenMobileNav }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const submitSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/students?q=${encodeURIComponent(value)}` : '/students');
  };

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="rounded-lg border border-line p-2 text-muted transition hover:text-ink md:hidden"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      <div className="mr-auto min-w-0">
        <h2 className="truncate text-base font-semibold text-ink">{currentTitle(location.pathname)}</h2>
        <p className="text-[11px] text-muted">CampusOS · Next.js · local relational demo</p>
      </div>

      <form onSubmit={submitSearch} className="relative hidden sm:block">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search students…"
          className="input w-56 pl-9 py-2 text-xs"
          aria-label="Search students"
        />
      </form>

      <button
        type="button"
        onClick={onToggleTheme}
        className="rounded-xl border border-line p-2.5 text-muted transition hover:text-ink"
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <Link
        to="/settings"
        className="flex items-center gap-2 rounded-xl border border-line bg-panel px-2.5 py-1.5 transition hover:border-line"
        title="Administrator profile"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/10 text-accent">
          <UserRound size={15} />
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-xs font-medium text-ink">Administrator</span>
          <span className="block text-[10px] text-muted">Local demo</span>
        </span>
      </Link>
    </header>
  );
}
