import { Link } from 'react-router-dom';
import { friendlyLevel, descriptionTeaser } from '../lib/format';
import { ArrowRightIcon } from './Icons';

// Full-width listing row: role identity left, action right.
// The entire row is clickable (stretched link); "View & Apply" stays as the visible affordance.
export default function JobCard({ role, index = 0, as: TitleTag = 'h4' }) {
  const meta = [role.department, friendlyLevel(role.grade_label)].filter(Boolean).join('  ·  ');
  const href = `/jobs/${encodeURIComponent(role.job_code)}`;

  return (
    <article
      className="card-enter group relative bg-card border border-line rounded-sm p-5 sm:px-7 sm:py-6 md:flex md:items-center md:gap-8 transition duration-200 ease-out hover:border-berry hover:shadow-[0_2px_14px_rgba(111,20,60,0.06)]"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      {/* Stretched link: makes the whole row navigate */}
      <Link
        to={href}
        aria-label={`View and apply — ${role.designation}`}
        className="absolute inset-0 z-[1] rounded-sm"
        tabIndex={-1}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 flex-wrap">
          <TitleTag className="font-display text-[22px] font-semibold text-ink leading-snug">
            {role.designation}
          </TitleTag>
          {role.openings > 1 && (
            <span className="shrink-0 font-button text-[11px] uppercase tracking-[1.5px] font-medium text-berry bg-berry-soft px-2.5 py-1 rounded-sm tabular-nums whitespace-nowrap">
              {role.openings} openings
            </span>
          )}
        </div>
        <p className="mt-1.5 font-button text-[11px] uppercase tracking-[1.5px] text-muted">
          {meta}
        </p>
        <p className="mt-2.5 text-[13px] text-body leading-relaxed line-clamp-2 md:line-clamp-1 md:max-w-3xl">
          {descriptionTeaser(role.job_description)}
        </p>
      </div>

      <div className="mt-4 pt-4 border-t border-line md:mt-0 md:pt-0 md:border-t-0 md:shrink-0 flex items-center justify-end gap-3">
        <Link
          to={href}
          className="relative z-[2] shrink-0 inline-flex items-center gap-2 min-h-[44px] sm:min-h-[40px] font-button text-xs uppercase tracking-[2px] font-medium text-berry hover:text-berry-dark active:opacity-80 transition-colors duration-200"
        >
          View &amp; Apply
          <ArrowRightIcon
            size={15}
            className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </article>
  );
}
