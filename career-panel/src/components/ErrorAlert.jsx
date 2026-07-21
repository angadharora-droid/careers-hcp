import { AlertCircleIcon } from './Icons';

export default function ErrorAlert({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="bg-brand-red/10 border border-brand-red/30 text-brand-red rounded-sm px-4 py-3 text-[13px] flex flex-wrap items-center gap-3"
    >
      <AlertCircleIcon size={16} className="shrink-0" />
      <span className="font-medium">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto shrink-0 inline-flex items-center justify-center min-h-[40px] border border-brand-red text-brand-red font-button text-[11px] uppercase tracking-[2px] rounded-sm px-4 py-1.5 hover:bg-brand-red hover:text-white active:scale-[0.98] transition duration-200"
        >
          Try again
        </button>
      )}
    </div>
  );
}
