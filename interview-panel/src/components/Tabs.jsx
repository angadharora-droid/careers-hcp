import { NavLink, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'My Assignments' },
  { to: '/compare', label: 'Panel Comparison' },
  { to: '/framework', label: 'Framework & Guide' },
];

export default function Tabs() {
  const { pathname } = useLocation();

  const isActive = (to) => {
    if (to === '/') return pathname === '/' || pathname.startsWith('/score');
    return pathname.startsWith(to);
  };

  return (
    <nav aria-label="Sections" className="bg-cream border-b border-line px-4 sm:px-6 flex gap-1 overflow-x-auto">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          aria-current={isActive(t.to) ? 'page' : undefined}
          className={`px-4 py-3 font-button text-xs font-medium uppercase tracking-[2px] whitespace-nowrap border-b-2 transition-colors duration-150 ${
            isActive(t.to)
              ? 'text-berry border-berry'
              : 'text-ink border-transparent hover:text-berry'
          }`}
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
