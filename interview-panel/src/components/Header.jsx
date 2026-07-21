import { useAuth } from '../context/AuthContext';
import { IconLogOut } from './Icons';

export default function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="bg-cream border-b border-line sticky top-0 z-20 px-4 sm:px-6 py-3.5 flex items-center justify-between flex-wrap gap-2.5">
      <div>
        {/* Wordmark, not the page heading — each page renders its own h1. */}
        <div className="font-display text-xl font-bold text-ink leading-tight">Centre Point</div>
        <div className="font-button text-[11px] font-medium uppercase tracking-[2px] text-muted mt-0.5">
          Interviewer Platform · Attitude 60 · Skills 25 · Knowledge 15
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right leading-tight">
          <div className="text-[13px] font-semibold text-ink">{user?.name}</div>
          <div className="font-button text-[11px] uppercase tracking-[1.5px] text-muted">
            {user?.designation || 'Interview Panellist'}
          </div>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 font-button font-medium uppercase tracking-[2px] text-[11px] min-h-[40px] border border-ink text-ink rounded-sm px-4 hover:text-berry hover:border-berry cursor-pointer transition duration-150 ease-out active:scale-[0.98]"
        >
          <IconLogOut size={14} />
          Logout
        </button>
      </div>
    </header>
  );
}
