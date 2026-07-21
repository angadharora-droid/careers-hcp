import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  LayoutDashboard, Table, Users, Flag, BookOpen, UserPlus, Menu, X, LogOut,
} from './Icons';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/register', label: 'Position Register', icon: Table },
  { to: '/applications', label: 'Applications', icon: Users },
  { to: '/red-flags', label: 'Red Flags', icon: Flag },
  { to: '/framework', label: 'Framework', icon: BookOpen },
  { to: '/interviewers', label: 'Interviewers', icon: UserPlus },
];

function Wordmark() {
  return (
    <div>
      <div className="font-display text-[21px] font-bold text-ink leading-none">Centre Point</div>
      <div className="font-button text-[11px] font-medium uppercase tracking-[1.5px] text-muted mt-1.5 leading-snug">
        Recruitment &amp; Position Control · Amravati
      </div>
    </div>
  );
}

function NavItems({ redCount, onNavigate }) {
  return (
    <nav aria-label="Primary" className="py-2">
      {NAV.map((item) => {
        const IconCmp = item.icon;
        const showBadge = item.to === '/red-flags' && redCount > 0;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `relative flex items-center gap-2.5 px-5 py-2.5 min-h-11 font-button text-[11.5px] font-medium uppercase tracking-[1.5px] transition-colors duration-150 ${
                isActive
                  ? 'bg-berry-soft text-berry before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-berry'
                  : 'text-ink/70 hover:text-berry hover:bg-cream/60'
              }`
            }
          >
            <IconCmp size={16} />
            <span className="flex-1">{item.label}</span>
            {showBadge && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-red text-white font-sans text-[11px] font-semibold normal-case tracking-normal tabular-nums leading-none">
                {redCount}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function UserBlock({ user, logout }) {
  return (
    <div className="border-t border-line p-4">
      {user && (
        <div className="mb-2.5 leading-tight">
          <div className="text-[13px] font-semibold text-ink truncate">{user.name}</div>
          <div className="text-[11px] text-muted mt-0.5 truncate">
            {user.designation || (user.role === 'hr_admin' ? 'HR Administrator' : user.role)}
          </div>
        </div>
      )}
      <button type="button" className="btn btn-ghost btn-sm w-full" onClick={logout}>
        <LogOut size={14} />
        Logout
      </button>
    </div>
  );
}

// <lg slide-in nav drawer: 200ms transform, Escape/backdrop close, focus restore.
function MobileNav({ onClose, redCount, user, logout }) {
  const [shown, setShown] = useState(false);
  const panelRef = useRef(null);
  const prevFocus = useRef(null);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    const raf = requestAnimationFrame(() => setShown(true));
    panelRef.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      prevFocus.current?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ease-out ${shown ? 'opacity-100' : 'opacity-0'}`}
        onMouseDown={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={`absolute left-0 top-0 h-full w-[260px] bg-card border-r border-line flex flex-col transition-transform duration-200 ease-out focus:outline-none ${shown ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-start justify-between gap-2 p-5 border-b border-line">
          <Wordmark />
          <button type="button" className="icon-btn -mt-1.5 -mr-1.5" aria-label="Close navigation" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavItems redCount={redCount} onNavigate={onClose} />
        </div>
        <UserBlock user={user} logout={logout} />
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [redCount, setRedCount] = useState(0);

  // Red-flag count for the nav badge — fetched once, non-blocking, silent fail.
  useEffect(() => {
    let alive = true;
    api.get('/dashboard/summary')
      .then((d) => { if (alive) setRedCount(d.red_flag_queue_count || 0); })
      .catch(() => { /* badge is best-effort */ });
    return () => { alive = false; };
  }, []);

  // Close the mobile drawer on route change (e.g. back button).
  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-cream">
      {/* lg+ fixed sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[240px] bg-card border-r border-line flex-col z-40">
        <div className="p-5 pb-4 border-b border-line">
          <Wordmark />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavItems redCount={redCount} />
        </div>
        <UserBlock user={user} logout={logout} />
      </aside>

      {/* <lg cream top bar with hamburger */}
      <header className="lg:hidden bg-cream border-b border-line px-4 py-2.5 flex items-center gap-3 sticky top-0 z-40">
        <button type="button" className="icon-btn -ml-1.5" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
          <Menu size={20} />
        </button>
        <div>
          <div className="font-display text-[18px] font-bold text-ink leading-none">Centre Point</div>
          <div className="font-button text-[11px] font-medium uppercase tracking-[1.5px] text-muted mt-0.5">
            Recruitment · Amravati
          </div>
        </div>
      </header>

      {navOpen && (
        <MobileNav onClose={() => setNavOpen(false)} redCount={redCount} user={user} logout={logout} />
      )}

      <div className="lg:pl-[240px]">
        <main className="max-w-[1340px] mx-auto px-4 md:px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
