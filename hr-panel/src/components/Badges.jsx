// Shared chip shape: uppercase, letterspaced, small radius — quiet luxury, no pill shapes.
const CHIP = 'inline-block px-2 py-0.5 rounded-sm text-[11px] font-semibold uppercase tracking-[1px] whitespace-nowrap';

const STATUS_STYLES = {
  Filled: 'bg-brand-green/10 text-brand-green',
  Vacant: 'bg-brand-red/10 text-brand-red',
  'Under Recruitment': 'bg-brand-amber/12 text-brand-amber',
  Frozen: 'bg-[#3a3f8f]/10 text-[#3a3f8f]',
  'On Hold': 'bg-muted/12 text-muted',
  Contract: 'bg-[#1f6b82]/10 text-[#1f6b82]',
  Outsourced: 'bg-[#8a5a1f]/12 text-[#8a5a1f]',
  Eliminated: 'bg-footer text-cream',
};

export function StatusPill({ status }) {
  return (
    <span className={`${CHIP} ${STATUS_STYLES[status] || 'bg-muted/12 text-muted'}`}>
      {status}
    </span>
  );
}

const STAGE_STYLES = {
  Applied: 'bg-brand-blue/10 text-brand-blue',
  'Interview Scheduled': 'bg-brand-amber/12 text-brand-amber',
  Selected: 'bg-brand-green/10 text-brand-green',
  Rejected: 'bg-brand-red/10 text-brand-red',
  'On Hold': 'bg-muted/12 text-muted',
};

export function StageBadge({ stage }) {
  return (
    <span className={`${CHIP} py-[3px] ${STAGE_STYLES[stage] || 'bg-muted/12 text-muted'}`}>
      {stage}
    </span>
  );
}

const REC_STYLES = {
  'Strongly Recommend': 'bg-brand-green/12 text-brand-green',
  Recommend: 'bg-brand-green/8 text-[#4a7c3f]',
  Hold: 'bg-brand-amber/12 text-brand-amber',
  'Do Not Recommend': 'bg-brand-red/10 text-brand-red',
};

export function RecChip({ rec }) {
  if (!rec) return null;
  return (
    <span className={`${CHIP} px-2.5 py-[3px] ${REC_STYLES[rec] || 'bg-muted/12 text-muted'}`}>
      {rec}
    </span>
  );
}

const SECTION_META = {
  att: { label: 'Attitude', cls: 'bg-brand-green/10 text-brand-green' },
  skill: { label: 'Skills', cls: 'bg-brand-blue/10 text-brand-blue' },
  know: { label: 'Knowledge', cls: 'bg-brand-amber/12 text-brand-amber' },
};

export function SectionTag({ section }) {
  const m = SECTION_META[section] || { label: section, cls: 'bg-muted/12 text-muted' };
  return <span className={`${CHIP} ${m.cls}`}>{m.label}</span>;
}

// Small amber/blue chips for Critical / Rev / Guest flags
export function FlagPill({ tone = 'blue', children }) {
  const cls = tone === 'amber' ? 'bg-brand-amber/12 text-brand-amber' : 'bg-brand-blue/10 text-brand-blue';
  return <span className={`${CHIP} ${cls}`}>{children}</span>;
}

export function AssignmentChip({ status }) {
  const scored = status === 'Scored';
  return (
    <span className={`${CHIP} ${scored ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-amber/12 text-brand-amber'}`}>
      {status}
    </span>
  );
}
