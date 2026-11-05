import { useEffect, useRef, useState } from 'react';
import { Database, Pause, Play, RefreshCw } from 'lucide-react';
import api, { errorMessage } from '../services/api';

export default function DbViewer() {
  const [items, setItems] = useState([]);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function refresh() {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        const { data } = await api.get('/dbviewer', { signal: controller.signal });
        if (active) { setItems(data.items); setError(''); setUpdated(new Date()); }
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) { inFlight.current = false; setBusy(false); }
      }
    }
    refresh();
    const timer = paused ? null : setInterval(refresh, 3000);
    return () => { active = false; controller.abort(); clearInterval(timer); inFlight.current = false; };
  }, [paused, attempt]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent"><Database size={15} /> Administration</p><h1 className="text-2xl font-semibold text-ink">SQL activity</h1><p className="mt-2 text-sm text-muted">Recent query templates and request outcomes. No parameters or credentials.</p></div>
        <div className="flex gap-2"><button type="button" className="btn-ghost" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? <Play size={15} /> : <Pause size={15} />}{paused ? 'Resume polling' : 'Pause polling'}</button><button type="button" className="btn-primary" disabled={busy} onClick={() => setAttempt((n) => n + 1)}><RefreshCw size={15} />{busy ? 'Refreshing…' : 'Refresh'}</button></div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted" role="status"><span>{paused ? 'Polling paused' : 'Polling every 3 seconds'} · Latest {items.length} events (up to 200)</span><span>{updated ? `Last updated ${updated.toLocaleTimeString()}` : 'Waiting for first update…'}</span></div>
      {error && <div role="alert" className="card flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-sm text-danger">{error} {updated && 'Showing last successful results.'}</p><button type="button" className="btn-ghost" disabled={busy} onClick={() => setAttempt((n) => n + 1)}>Retry</button></div>}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">SQL audit events</caption>
          <thead className="border-b border-line bg-soft text-xs text-muted"><tr>{['Time', 'Result', 'Duration', 'Request', 'Role', 'SQL template', 'Rows'].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{[...items].reverse().map((event) => <tr key={event.id}>
            <td className="whitespace-nowrap px-4 py-4 text-xs text-muted">{event.timestamp ? new Date(event.timestamp).toLocaleString() : '—'}</td>
            <td className="px-4 py-4"><span className={event.success === true ? 'text-accent' : event.success === false ? 'text-danger' : 'text-muted'}>{event.success === true ? 'Success' : event.success === false ? 'Failed' : 'Pending'}</span></td>
            <td className="whitespace-nowrap px-4 py-4 text-ink">{event.duration_ms == null ? '—' : `${Number(event.duration_ms).toFixed(2)} ms`}</td>
            <td className="px-4 py-4"><p className="font-mono text-xs text-ink">{event.method} {event.path}</p><p className="mt-1 text-xs text-muted">{event.request_id}</p></td>
            <td className="px-4 py-4 text-muted">{event.role || '—'}</td>
            <td className="min-w-[320px] px-4 py-4"><pre className="max-w-2xl whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink">{event.sql}</pre></td>
            <td className="px-4 py-4 text-muted">{event.rows ?? '—'}</td>
          </tr>)}</tbody>
        </table>
        {!items.length && <p className="p-8 text-center text-sm text-muted">{busy ? 'Loading SQL activity…' : error ? 'Activity could not be loaded.' : 'No query activity yet. Browse campus records to generate events.'}</p>}
      </div>
      <p className="text-xs text-muted">In-memory audit history. Authentication, account and session statements are excluded.</p>
    </div>
  );
}
