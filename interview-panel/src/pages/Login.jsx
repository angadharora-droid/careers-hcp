import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { btnPrimary, inputCls, labelCls } from '../components/ui';
import { IconLoader } from '../components/Icons';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const emailRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      emailRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream px-4">
      <div className="max-w-[360px] mx-auto mt-20 bg-card border border-line rounded-sm p-8 text-center rise-in">
        <div className="font-button text-[11px] font-medium uppercase tracking-[2px] text-berry mb-2">
          Centre Point
        </div>
        <h1 className="font-display text-[26px] font-semibold text-ink leading-tight mb-1.5">
          Interviewer Platform
        </h1>
        <p className="font-button text-[11px] uppercase tracking-[2px] text-muted mb-5">
          Centre Point Amravati · Recruitment 2026
        </p>

        <form onSubmit={onSubmit} className="text-left">
          <label className={labelCls} htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            ref={emailRef}
            type="email"
            required
            autoFocus
            autoComplete="email"
            inputMode="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="gm@cph.in"
          />
          <label className={labelCls} htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-brand-red text-xs mt-2">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full mt-4`}>
            {busy && <IconLoader size={14} className="animate-spin" aria-hidden="true" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-[11px] text-muted mt-4">
          e.g. gm@cph.in / panel@2026 <span className="whitespace-nowrap">(seeded demo login)</span>
        </p>
      </div>
    </div>
  );
}
