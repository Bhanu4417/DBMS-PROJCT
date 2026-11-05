import { useEffect, useState } from 'react';
import { UserPlus, ShieldCheck } from 'lucide-react';
import api, { errorMessage } from '../services/api';

export default function AdminAccounts() {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    api.get('/students/options', { signal: controller.signal })
      .then(({ data }) => { if (active) setStudents(data); })
      .catch((err) => { if (active) setLoadError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [attempt]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setCreated(null);
    if (!studentId || password.length < 12 || password.length > 256) {
      setError('Select a student and enter a password between 12 and 256 characters.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post('/admin/accounts', { student_id: Number(studentId), password });
      setCreated(data);
      setPassword('');
      setStudentId('');
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <header><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">Administration</p><h1 className="text-2xl font-semibold text-ink">Student accounts</h1><p className="mt-2 text-sm text-muted">Give an existing student secure access to their campus records.</p></header>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
        <section className="card p-6">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><UserPlus size={18} className="text-accent" /> Create student account</h2>
          {loading ? <p role="status" className="mt-6 text-sm text-muted">Loading student options…</p> : loadError ? <div role="alert" className="mt-5 space-y-3"><p className="text-sm text-danger">{loadError}</p><button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>Retry</button></div> : <form className="mt-6 space-y-5" onSubmit={submit}>
            <label className="block text-sm text-ink">Student<select className="input mt-2" required disabled={busy || !students.length} value={studentId} onChange={(e) => { setStudentId(e.target.value); setCreated(null); }}><option value="">Select a student</option>{students.map((student) => <option key={student.value} value={student.value}>{student.label}</option>)}</select></label>
            {!students.length && <p className="text-sm text-muted">No students available. Add student records before provisioning accounts.</p>}
            <label className="block text-sm text-ink">Initial password<input className="input mt-2" type="password" autoComplete="new-password" minLength={12} maxLength={256} required disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="password-help" /></label>
            <p id="password-help" className="text-xs text-muted">Use 12–256 characters. Share the password securely with the student.</p>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button className="btn-primary" disabled={busy || !students.length}>{busy ? 'Creating account…' : 'Create account'}</button>
          </form>}
          {created && <div role="status" className="mt-5 rounded-lg border border-line bg-soft p-4"><p className="text-sm font-semibold text-accent">Account created</p><p className="mt-2 break-all text-sm text-ink">{created.email}</p><p className="mt-1 text-xs text-muted">Role: {created.role} · Student ID: {created.student_id}</p></div>}
        </section>
        <aside className="card self-start p-5"><ShieldCheck size={22} className="mb-4 text-accent" /><h2 className="font-semibold text-ink">Student access only</h2><p className="mt-3 text-sm leading-relaxed text-muted">The sign-in email comes from the selected student’s record. Accounts can only view their own courses, attendance and library loans.</p><p className="mt-4 text-sm leading-relaxed text-muted">This creates a new account. It does not reset passwords or replace existing accounts.</p></aside>
      </div>
    </div>
  );
}
