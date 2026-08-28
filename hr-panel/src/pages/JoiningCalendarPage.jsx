import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { inr, fmtDate } from '../lib/format';
import { ErrorBox, Empty, TileSkeleton, CardSkeleton } from '../components/LoadState';
import PageHeader from '../components/PageHeader';
import ApplicantDrawer from '../components/ApplicantDrawer';
import {
  Calendar, Clock, UserCheck, AlertCircle, ChevronRight, ArrowLeft, Inbox, Check,
} from '../components/Icons';

/* The Joining Calendar — when the people already selected actually arrive.
   Selection fills the seat on paper; this page tracks the day each hire walks
   in, so HR can prepare the joining and chase the dates still unset. */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// date_of_joining is a plain 'YYYY-MM-DD'. Parsed by hand — new Date('YYYY-MM-DD')
// reads UTC midnight, which lands on the previous day west of Greenwich.
function partsOf(doj) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(doj || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo - 1, d };
}

const keyOf = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Formats from the hand-parsed parts, so the table can never disagree with the
// calendar square the same record sits in (fmtDate would re-parse as UTC).
const fmtDoj = (p) =>
  new Date(p.y, p.m, p.d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function Stat({ n, label, tone, icon: IconCmp, hint }) {
  const color = tone === 'red' ? 'text-brand-red' : tone === 'amber' ? 'text-brand-amber' : 'text-ink';
  return (
    <div className="bg-card border border-line rounded-md p-4">
      <div className="flex items-start justify-between gap-2">
        <div className={`font-display text-[30px] font-semibold leading-none tabular-nums ${color}`}>{n}</div>
        {IconCmp && <IconCmp size={16} className="text-muted/70 mt-0.5" />}
      </div>
      <div className="font-button text-[11px] font-medium text-muted uppercase tracking-[1.5px] mt-2">{label}</div>
      {hint && <div className="text-[10.5px] text-muted/80 mt-1 leading-snug">{hint}</div>}
    </div>
  );
}

const STATUS_CHIP = {
  'Awaiting joining': 'bg-brand-amber/12 text-brand-amber border-brand-amber/30',
  Joined: 'bg-brand-green/10 text-brand-green border-brand-green/30',
};

export default function JoiningCalendarPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [openId, setOpenId] = useState(null);

  const today = new Date();
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await api.get('/applications/joinings');
      setData(d.joinings || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { byDay, dated, undated } = useMemo(() => {
    const map = new Map();
    const withDate = [];
    const without = [];
    for (const j of data || []) {
      const p = partsOf(j.date_of_joining);
      if (!p) { without.push(j); continue; }
      withDate.push({ ...j, _p: p });
      const k = keyOf(p.y, p.m, p.d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(j);
    }
    return { byDay: map, dated: withDate, undated: without };
  }, [data]);

  const monthJoiners = useMemo(
    () => dated.filter((j) => j._p.y === month.y && j._p.m === month.m),
    [dated, month]
  );

  const totals = useMemo(() => ({
    awaiting: (data || []).filter((j) => j.joining_status === 'Awaiting joining').length,
    joined: (data || []).filter((j) => j.joining_status === 'Joined').length,
  }), [data]);

  // Monday-start grid: leading blanks, then the days of the viewed month.
  const cells = useMemo(() => {
    const lead = (new Date(month.y, month.m, 1).getDay() + 6) % 7;
    const days = new Date(month.y, month.m + 1, 0).getDate();
    return [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [month]);

  const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate());
  const isThisMonth = month.y === today.getFullYear() && month.m === today.getMonth();

  const shift = (delta) => setMonth(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const header = (
    <PageHeader title="Joining Calendar" sub="When selected candidates actually arrive · chase the dates still unset" />
  );

  if (loading) {
    return (
      <div>
        {header}
        <TileSkeleton count={4} />
        <CardSkeleton lines={8} />
      </div>
    );
  }
  if (err) return <div>{header}<ErrorBox error={err} onRetry={load} /></div>;

  return (
    <div>
      {header}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat
          n={monthJoiners.length}
          label={`Joining in ${MONTHS[month.m].slice(0, 3)} ${month.y}`}
          icon={Calendar}
        />
        <Stat
          n={totals.awaiting}
          label="Awaiting Joining"
          icon={Clock}
          tone={totals.awaiting > 0 ? 'amber' : undefined}
          hint="Selected, joining date still ahead"
        />
        <Stat n={totals.joined} label="Joined" icon={UserCheck} hint="Joining date has arrived" />
        <Stat
          n={undated.length}
          label="No Date Set"
          icon={AlertCircle}
          tone={undated.length > 0 ? 'red' : undefined}
          hint="Selected without a joining date on file"
        />
      </div>

      {/* The month */}
      <div className="card">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <h2 className="font-display text-[20px] font-semibold text-ink leading-none">
            {MONTHS[month.m]} {month.y}
          </h2>
          <div className="flex items-center gap-1.5 ml-auto">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => shift(-1)} aria-label="Previous month">
              <ArrowLeft size={13} />
              Prev
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setMonth({ y: today.getFullYear(), m: today.getMonth() })}
              disabled={isThisMonth}
            >
              Today
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => shift(1)} aria-label="Next month">
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        <div className="mini flex items-center gap-x-3 gap-y-1 flex-wrap mb-2">
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-brand-amber inline-block" /> awaiting joining
          </span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-brand-green inline-block" /> joined
          </span>
          <span>Click a name for the full record.</span>
        </div>

        <div className="tbl-scroll">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 gap-px">
              {WEEKDAYS.map((w) => (
                <div key={w} className="font-button text-[10px] font-medium text-muted uppercase tracking-[1.2px] px-2 py-1.5">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-line border border-line rounded-sm overflow-hidden">
              {cells.map((day, i) => {
                if (day === null) return <div key={`blank-${i}`} className="bg-cream/60 min-h-[92px]" />;
                const k = keyOf(month.y, month.m, day);
                const joiners = byDay.get(k) || [];
                const isToday = k === todayKey;
                return (
                  <div key={k} className={`bg-card min-h-[92px] p-1.5 ${isToday ? 'ring-1 ring-inset ring-berry' : ''}`}>
                    <div className={`text-[11px] font-semibold tabular-nums mb-1 ${isToday ? 'text-berry' : 'text-muted'}`}>
                      {day}
                      {isToday && <span className="ml-1 font-button text-[9px] uppercase tracking-[1px]">today</span>}
                    </div>
                    {joiners.map((j) => (
                      <button
                        key={String(j.id)}
                        type="button"
                        onClick={() => setOpenId(j.id)}
                        title={`${j.candidate_name} — ${j.designation}${j.pcn ? ` · ${j.pcn}` : ''}`}
                        className={`block w-full text-left border rounded-sm px-1.5 py-1 mb-1 text-[11px] leading-tight cursor-pointer transition-colors duration-150 hover:border-berry ${STATUS_CHIP[j.joining_status] || 'bg-muted/12 text-muted border-line'}`}
                      >
                        <span className="font-semibold block truncate">{j.candidate_name}</span>
                        <span className="block truncate opacity-80">{j.designation}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {monthJoiners.length === 0 && (
          <p className="mini mt-2">No joinings fall in {MONTHS[month.m]} {month.y}.</p>
        )}
      </div>

      {/* This month, as a list — the details behind the calendar squares */}
      <div className="card">
        <h2 className="card-h">Joining details — {MONTHS[month.m]} {month.y} <span className="r">{monthJoiners.length} joining{monthJoiners.length === 1 ? '' : 's'}</span></h2>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th><th>Candidate</th><th>Designation</th><th>Dept</th><th>PCN (seat)</th>
                <th className="num">Offered ₹/mo</th><th>Offer Letter</th><th>Status</th><th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {monthJoiners.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <Empty icon={Inbox} title="No joinings this month">
                      Joining dates set on Selected candidates appear here.
                    </Empty>
                  </td>
                </tr>
              ) : (
                [...monthJoiners]
                  .sort((a, b) => a._p.d - b._p.d)
                  .map((j) => (
                    <tr key={String(j.id)}>
                      <td className="whitespace-nowrap font-medium text-ink">{fmtDoj(j._p)}</td>
                      <td>
                        <b>{j.candidate_name}</b>
                        <div className="mini font-mono">{j.reference_id}</div>
                        <div className="mini">{j.mobile}</div>
                      </td>
                      <td>
                        {j.designation}
                        <div className="mini">Grade {j.grade}</div>
                      </td>
                      <td>{j.department}</td>
                      <td className="pcn">{j.pcn || '—'}</td>
                      <td className="num whitespace-nowrap">{j.offered_salary != null ? inr(j.offered_salary) : <span className="mini">—</span>}</td>
                      <td>
                        {j.offer_sent_at ? (
                          <span className="inline-flex items-center gap-1 text-brand-green text-xs font-medium whitespace-nowrap">
                            <Check size={12} />
                            Sent {fmtDate(j.offer_sent_at)}
                          </span>
                        ) : (
                          <span className="mini">not sent</span>
                        )}
                      </td>
                      <td>
                        <span className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-semibold uppercase tracking-[1px] whitespace-nowrap border ${STATUS_CHIP[j.joining_status] || 'bg-muted/12 text-muted border-line'}`}>
                          {j.joining_status === 'Joined' ? 'Joined' : 'Awaiting'}
                        </span>
                        {j.employee_code && <div className="mini font-mono mt-1">Emp {j.employee_code}</div>}
                      </td>
                      <td>
                        <button type="button" className="btn btn-sm" onClick={() => setOpenId(j.id)}>Open</button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected but no date on file — the list to chase */}
      {undated.length > 0 && (
        <div className="card">
          <h2 className="card-h">Joining date not set <span className="r">Selected, but no date on file — chase these</span></h2>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Candidate</th><th>Designation</th><th>Dept</th><th>PCN (seat)</th>
                  <th className="num">Offered ₹/mo</th><th>Contact</th><th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {undated.map((j) => (
                  <tr key={String(j.id)}>
                    <td>
                      <b>{j.candidate_name}</b>
                      <div className="mini font-mono">{j.reference_id}</div>
                    </td>
                    <td>
                      {j.designation}
                      <div className="mini">Grade {j.grade}</div>
                    </td>
                    <td>{j.department}</td>
                    <td className="pcn">{j.pcn || '—'}</td>
                    <td className="num whitespace-nowrap">{j.offered_salary != null ? inr(j.offered_salary) : <span className="mini">—</span>}</td>
                    <td>
                      <div className="mini">{j.mobile}</div>
                      <div className="mini break-all">{j.email}</div>
                    </td>
                    <td>
                      <button type="button" className="btn btn-sm" onClick={() => setOpenId(j.id)}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openId && (
        <ApplicantDrawer
          applicationId={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
