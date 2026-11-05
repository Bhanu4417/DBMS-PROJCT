import { useState } from 'react';
import { GraduationCap, ArrowRight, ShieldCheck } from 'lucide-react';
import api, { errorMessage } from '../services/api';

const demos = {
  admin: { email: 'admin@campus.local', password: 'CampusAdmin!2026' },
  student: { email: 'student1@campus.edu.in', password: 'CampusStudent!2026' },
};

export default function Login({ onAuthenticated }) {
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      onAuthenticated(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#17191a] text-ink">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2 lg:gap-24">
        <section className="space-y-8">
          <div className="flex items-center gap-3 text-lg font-semibold"><GraduationCap className="text-accent" size={30} /> Campus portal</div>
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Your campus, connected</p>
            <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">A clear view of your academic life.</h1>
            <p className="max-w-md text-base leading-relaxed text-muted">Courses, attendance and library records. One secure place to stay informed and keep moving forward.</p>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted"><ShieldCheck size={18} className="text-accent" /> Secure, role-based access</p>
        </section>
        <section className="card p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Welcome back</h2>
          <p className="mt-2 text-sm text-muted">Sign in with your campus account.</p>
          <form className="mt-7 space-y-5" onSubmit={submit}>
            <label className="block text-sm">Email address<input className="input mt-2" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} /></label>
            <label className="block text-sm">Password<input className="input mt-2" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} /></label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button className="btn-primary w-full justify-center" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={16} /></button>
          </form>
          <div className="mt-7 rounded-lg border border-line bg-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Local demo</p>
            <div className="my-3 flex gap-2" role="group" aria-label="Demo account role">
              {Object.keys(demos).map((item) => <button key={item} type="button" disabled={busy} aria-pressed={role === item} className={role === item ? 'btn-primary text-xs' : 'btn-ghost text-xs'} onClick={() => setRole(item)}>{item === 'admin' ? 'Administrator' : 'Student'}</button>)}
            </div>
            <p className="break-all text-sm text-ink">{demos[role].email}</p>
            <p className="mt-1 font-mono text-xs text-muted">{demos[role].password}</p>
            <button type="button" className="btn-ghost mt-3 text-xs" disabled={busy} onClick={() => { setEmail(demos[role].email); setPassword(demos[role].password); setError(''); }}>Fill demo credentials</button>
            <p className="mt-3 text-xs leading-relaxed text-muted">Demo selection only fills credentials. Your account determines your access after sign-in.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
