import { useEffect, useState } from 'react';
import { CheckCircle2, Database, ExternalLink, MonitorCog, ShieldCheck, XCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import { useTheme } from '../hooks/useTheme';
import api, { API_BASE, errorMessage } from '../services/api';

export default function Settings() {
  const { theme, toggle } = useTheme();
  const [health, setHealth] = useState({ loading: true });
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .get('/health')
      .then((response) => active && setHealth({ loading: false, ok: true, data: response.data }))
      .catch((error) => active && setHealth({ loading: false, ok: false, error: errorMessage(error) }));
    api
      .get('/dashboard/stats')
      .then((response) => active && setStats(response.data))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Environment, appearance and database status for this local installation."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database size={17} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink">Database connection</h2>
          </div>
          {health.loading ? (
            <div className="skeleton h-16 w-full" />
          ) : health.ok ? (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 text-success">
                <CheckCircle2 size={16} /> Connected to SQLite
              </p>
              <Detail label="Database file" value="web/lib/.data/campus.sqlite" />
              <p className="mt-2 text-xs text-muted">Your changes are saved immediately in the persistent SQLite database. Schema and seed SQL files define initial structure/data; use the download above for a SQL snapshot of current records.</p>
              <Detail label="API status" value={<Badge value="Healthy" tone="success" />} />
              <a href={`${API_BASE}/database/export.sql`} className="btn-ghost mt-2 inline-flex text-xs" download>
                Download current database as SQL
              </a>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 text-danger">
                <XCircle size={16} /> Database unavailable
              </p>
              <p className="text-muted">{health.error}</p>
              <code className="block rounded-lg border border-line bg-soft px-3 py-2 text-xs text-ink">
                Database: web/lib/.data/campus.sqlite (created and seeded automatically)
              </code>
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <MonitorCog size={17} className="text-accentBlue" />
            <h2 className="text-sm font-semibold text-ink">Appearance</h2>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line bg-soft px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink">{theme === 'dark' ? 'Dark theme' : 'Light theme'}</p>
              <p className="text-xs text-muted">Saved in this browser only</p>
            </div>
            <button type="button" className="btn-ghost text-xs" onClick={toggle}>
              Switch to {theme === 'dark' ? 'light' : 'dark'}
            </button>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <Detail label="Total students" value={stats ? stats.total_students : '—'} />
            <Detail label="Total enrollments" value={stats ? stats.total_enrollments : '—'} />
            <Detail label="Total grades" value={stats ? stats.total_grades : '—'} />
          </div>
        </section>

        <section className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={17} className="text-success" />
            <h2 className="text-sm font-semibold text-ink">Access model</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            This local demo uses real password-hashed accounts and server-side sessions. Administrators manage records; students can view only their own academic records. Use HTTPS in production, change demonstration credentials, and review access policies before public deployment.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Documentation</h2>
          <ul className="space-y-2 text-sm">
            {[
              { label: 'Database health', href: '/api/health' },
              { label: 'Report catalogue', href: '/api/reports' },
              { label: 'Study pack and ER diagrams', href: '/learnit' },
            ].map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-accentBlue hover:underline"
                >
                  <ExternalLink size={13} /> {link.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            ER diagram, normalization notes and the project report live in the <code>learnit/</code> folder.
          </p>
        </section>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
