// Page-level header row: serif title, uppercase sub-line, primary action right-aligned.
export default function PageHeader({ title, sub, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="font-display text-[28px] md:text-[32px] font-semibold text-ink leading-none">{title}</h1>
        {sub && (
          <p className="font-button text-[11px] font-medium uppercase tracking-[1.5px] text-muted mt-2">{sub}</p>
        )}
      </div>
      {action}
    </div>
  );
}
