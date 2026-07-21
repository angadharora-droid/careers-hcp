import { AlertTriangle, Inbox } from './Icons';

export function Spinner({ className = '' }) {
  return (
    <span className={`inline-block w-4 h-4 border-2 border-line border-t-berry rounded-full animate-spin ${className}`} />
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="text-center py-9 text-muted text-[13px]">
      <Spinner className="align-[-3px] mr-2" />
      {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="bg-brand-red/8 border border-brand-red/50 text-brand-red rounded-sm px-3 py-2 text-xs my-2 flex items-center justify-between gap-3 flex-wrap"
    >
      <span className="flex items-start gap-2">
        <AlertTriangle size={14} className="mt-px" />
        {String(error)}
      </span>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-red" onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}

// Designed empty state: icon, serif one-liner, guidance, optional action.
export function Empty({ icon: IconCmp = Inbox, title, children, action }) {
  return (
    <div className="text-center py-10 px-4">
      <IconCmp size={28} className="mx-auto text-muted/70" />
      {title && <p className="font-display text-[20px] font-semibold text-ink mt-3 leading-tight">{title}</p>}
      {children && <p className="text-[13px] text-muted mt-1.5 max-w-[420px] mx-auto">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ===== Skeletons — cream/beige shimmer matching the layout ===== */

export function Skeleton({ className = '' }) {
  return <div className={`skel ${className}`} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-9 mb-1.5" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 mb-1.5" />
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="card" aria-hidden="true">
      <Skeleton className="h-6 w-1/3 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 mb-2.5 ${i % 2 ? 'w-5/6' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function TileSkeleton({ count = 7 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-line rounded-md p-4">
          <Skeleton className="h-8 w-14 mb-3" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
