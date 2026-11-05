import { useState } from 'react';
import { LogOut } from 'lucide-react';

export default function SessionControls({ user, onLogout }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setBusy(true);
    setError('');
    try { await onLogout(); }
    catch { setError('Sign out failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <div className="min-w-0"><p className="break-all text-ink">{user?.email}</p><p className="text-xs capitalize text-muted">{user?.role}</p></div>
      <button type="button" className="btn-ghost text-xs" onClick={logout} disabled={busy}><LogOut size={15} />{busy ? 'Signing out…' : 'Sign out'}</button>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
