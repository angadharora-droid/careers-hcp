import { Link, Outlet, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Open Positions', isActive: (path) => path === '/' || path.startsWith('/jobs') },
];

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-cream text-body font-sans">
      <header className="bg-cream border-b border-line sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
            <Link to="/" className="block active:opacity-80 transition-opacity duration-150">
              <img
                src="/img/cp-logo.png"
                alt="Centre Point"
                width="600"
                height="114"
                className="h-9 w-auto"
              />
              <span className="mt-1.5 block font-label text-[11px] uppercase tracking-[1.5px] text-muted">
                Careers · Centre Point Amravati
              </span>
            </Link>

            <nav className="flex items-center gap-5 sm:gap-7 overflow-x-auto">
              {NAV.map((item) => {
                const active = item.isActive(pathname);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={`font-button text-xs uppercase tracking-[2px] whitespace-nowrap py-2 border-b-2 transition-colors duration-200 active:opacity-80 ${
                      active
                        ? 'text-berry border-berry'
                        : 'text-ink border-transparent hover:text-berry'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <Link
                to="/"
                className="hidden md:inline-flex items-center justify-center min-h-[40px] shrink-0 bg-berry text-white font-button text-xs uppercase tracking-[2px] font-medium px-6 py-2.5 rounded-sm hover:bg-berry-dark active:scale-[0.98] transition duration-200"
              >
                View Openings
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-footer text-cream mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-10 sm:grid-cols-3">
          <div>
            <p className="font-display text-2xl font-semibold leading-none">Centre Point</p>
            <p className="mt-4 text-[13px] leading-relaxed text-cream/70">
              Warm, genuine hospitality in the heart of Vidarbha — we hire for attitude and train
              for skill.
            </p>
            <p className="mt-3 font-button text-[11px] uppercase tracking-[1.5px] text-cream/60">
              Centre Point Amravati · Amravati, Maharashtra
            </p>
          </div>
          <div>
            <p className="font-display text-lg font-semibold">Quick links</p>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  to="/"
                  className="inline-flex items-center min-h-[40px] sm:min-h-0 font-button text-[11px] uppercase tracking-[2px] text-cream/70 hover:text-cream transition-colors duration-200"
                >
                  Open Positions
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-display text-lg font-semibold">Centre Point</p>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href="https://centrepointnagpur.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center min-h-[40px] sm:min-h-0 font-button text-[11px] uppercase tracking-[2px] text-cream/70 hover:text-cream transition-colors duration-200"
                >
                  centrepointnagpur.com
                </a>
              </li>
              <li className="text-[13px] leading-relaxed text-cream/70">
                Walk-in enquiries: Front Desk, Centre Point Amravati
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-cream/15">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="font-button text-[11px] uppercase tracking-[2px] text-cream/50">
              © {new Date().getFullYear()} Centre Point Hospitality
            </p>
            <p className="font-button text-[11px] uppercase tracking-[2px] text-cream/50">
              We hire for attitude, train for skill
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
