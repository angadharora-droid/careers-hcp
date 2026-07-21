import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle } from '../components/Icons';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-[380px] bg-card border border-line rounded-md p-8 text-center">
        <h1 className="font-display text-[30px] font-semibold text-ink leading-none mb-2">Centre Point</h1>
        <p className="font-button text-[11px] font-medium uppercase tracking-[2px] text-muted mb-6">
          Recruitment &amp; Position Control · Amravati · 2026
        </p>

        <form onSubmit={submit} className="text-left">
          <label className="lbl" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="inp"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hr@cph.in"
            required
            autoFocus
          />
          <label className="lbl" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="inp"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {err && (
            <div role="alert" className="flex items-start gap-1.5 text-brand-red text-xs mt-2">
              <AlertCircle size={13} className="mt-px shrink-0" />
              <span>{err}</span>
            </div>
          )}
          <button type="submit" className="btn w-full mt-4" disabled={busy}>
            {busy && (
              <span
                aria-hidden="true"
                className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"
              />
            )}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mini mt-3.5">
          hr@cph.in / hr@2026 <span className="text-muted">(seeded demo login)</span>
        </p>
      </div>
    </div>
  );
}
