/* Shared visual primitives — Centre Point Nagpur design system (luxury-minimal). */
import { IconAlertCircle } from './Icons';

export const btnBase =
  'inline-flex items-center justify-center gap-1.5 font-button font-medium uppercase tracking-[2px] text-xs rounded-sm px-6 py-2.5 min-h-[44px] sm:min-h-[40px] cursor-pointer transition duration-150 ease-out active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 aria-disabled:opacity-50';
export const btnPrimary = `${btnBase} bg-berry text-white hover:bg-berry-dark`;
export const btnGhost = `${btnBase} bg-transparent text-ink border border-ink hover:text-berry hover:border-berry`;
export const btnGreen = `${btnBase} bg-brand-green text-white hover:opacity-90`;
export const btnDanger = `${btnBase} bg-brand-red text-white hover:opacity-90`;
export const btnSm = 'px-4 py-1.5 text-[11px]';

/** Page kicker + the page's single h1 (the header wordmark is decorative). */
export function PageHeader({ kicker = 'Interview Panel', title, sub, right }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 flex-wrap">
      <div>
        <div className="font-button text-[11px] font-medium uppercase tracking-[2px] text-berry">
          {kicker}
        </div>
        <h1 className="font-display text-[28px] font-semibold text-ink leading-tight mt-0.5">
          {title}
        </h1>
        {sub && <p className="text-[13px] text-muted mt-1 max-w-2xl">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`bg-card border border-line rounded-sm p-5 mb-4 ${className}`}>
      {title && (
        <h2 className="font-display text-lg font-semibold text-ink border-b border-line pb-2.5 mb-4 flex items-baseline justify-between gap-2 flex-wrap">
          <span>{title}</span>
          {right && (
            <span className="font-button text-[11px] font-medium uppercase tracking-[1.5px] text-muted">
              {right}
            </span>
          )}
        </h2>
      )}
      {children}
    </section>
  );
}

const badgeBase =
  'inline-block font-button text-[11px] font-medium uppercase tracking-[1.5px] px-2 py-0.5 rounded-sm whitespace-nowrap';

const STAGE_STYLES = {
  Applied: 'bg-[#e7eff7] text-brand-blue',
  'Interview Scheduled': 'bg-[#f6e8cf] text-brand-amber',
  Selected: 'bg-[#e8f4ec] text-brand-green',
  Rejected: 'bg-[#fbe9e7] text-brand-red',
  'On Hold': 'bg-[#eee7dd] text-muted',
};

export function StageBadge({ stage }) {
  return (
    <span className={`${badgeBase} ${STAGE_STYLES[stage] || 'bg-[#eee7dd] text-muted'}`}>
      {stage}
    </span>
  );
}

const REC_STYLES = {
  'Strongly Recommend': 'bg-[#e8f4ec] text-brand-green',
  Recommend: 'bg-[#eef7ec] text-[#4a7c3f]',
  Hold: 'bg-[#f6e8cf] text-brand-amber',
  'Do Not Recommend': 'bg-[#fbe9e7] text-brand-red',
};

export function RecChip({ rec }) {
  return (
    <span
      className={`inline-block px-3 py-1 rounded-sm font-button font-semibold text-[11px] uppercase tracking-[1.5px] whitespace-nowrap ${
        REC_STYLES[rec] || 'bg-[#eee7dd] text-muted'
      }`}
    >
      {rec}
    </span>
  );
}

export const SECTIONS = {
  att: { name: 'Attitude', weight: '60%', cls: 'bg-[#e8f4ec] text-brand-green' },
  skill: { name: 'Skills', weight: '25%', cls: 'bg-[#eef2f7] text-brand-blue' },
  know: { name: 'Knowledge', weight: '15%', cls: 'bg-[#f6e8cf] text-brand-amber' },
};

export function InfoBanner({ children }) {
  return (
    <div className="bg-beige/40 border-l-2 border-berry px-4 py-2.5 text-xs text-body rounded-r-sm mb-4">
      {children}
    </div>
  );
}

/** Cream/beige shimmer block; compose these to mirror the loaded layout. */
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`skeleton rounded-sm ${className}`} />;
}

export function ErrorBox({ children, onRetry }) {
  return (
    <div
      role="alert"
      className="bg-[#fbe9e7] border border-brand-red/40 text-brand-red rounded-sm px-4 py-3 text-[12.5px] mb-4 flex items-start gap-2.5"
    >
      <IconAlertCircle className="mt-px shrink-0" />
      <div className="flex-1">{children}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="font-button text-[11px] font-medium uppercase tracking-[1.5px] underline underline-offset-2 hover:no-underline cursor-pointer shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }) {
  return (
    <div className="text-center py-12 px-4 rise-in">
      {icon && (
        <div
          aria-hidden="true"
          className="mx-auto mb-3.5 h-12 w-12 rounded-full bg-beige/70 text-muted flex items-center justify-center"
        >
          {icon}
        </div>
      )}
      {title && <p className="font-display text-xl font-semibold text-ink">{title}</p>}
      {children && <p className="text-[13px] text-muted mt-1.5 max-w-md mx-auto">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, value, className = '' }) {
  return (
    <div className={className}>
      <div className="font-button text-[11px] uppercase tracking-[1.5px] text-muted font-medium">
        {label}
      </div>
      <div className="text-[13px] text-body mt-0.5 whitespace-pre-wrap">{value || '—'}</div>
    </div>
  );
}

export const thCls =
  'bg-beige text-left px-2.5 py-2 font-button font-medium border border-line text-muted text-[11px] uppercase tracking-[1.5px]';
export const tdCls = 'px-2.5 py-2 border border-line align-top text-[12.5px] text-body';

export const inputCls =
  'w-full px-3 py-2 min-h-[44px] border border-line rounded-sm text-[16px] sm:text-[13px] bg-beige/40 text-ink transition-colors duration-150 focus:border-berry';
export const textareaCls =
  'w-full px-3 py-2 border border-line rounded-sm text-[16px] sm:text-[13px] bg-beige/40 text-ink transition-colors duration-150 focus:border-berry resize-y min-h-[76px]';
export const labelCls =
  'block font-button text-[11px] font-medium uppercase tracking-[1.5px] text-muted mt-3 mb-1';
