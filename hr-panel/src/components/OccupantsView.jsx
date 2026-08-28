import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { inr, band, fmtDate } from '../lib/format';
import { ErrorBox, Empty, TableSkeleton, TileSkeleton } from './LoadState';
import { FlagPill, BandPill } from './Badges';
import ConfirmDialog from './ConfirmDialog';
import OccupantDrawer, { JoiningPill } from './OccupantDrawer';
import { Search, X, UserCheck, Users, CheckCircle, AlertTriangle, Inbox, Clock } from './Icons';
import { useToast } from '../context/ToastContext';

/* The occupant side of the Position Control Register: who holds which sanctioned
   seat. Lives inside the register as its own tab — seats and the people in them
   are two views of the same control, not two pages. */

function Stat({ n, label, tone, icon: IconCmp, to }) {
  const color = tone === 'red' ? 'text-brand-red' : tone === 'amber' ? 'text-brand-amber' : 'text-ink';
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={`font-display text-[30px] font-semibold leading-none tabular-nums ${color}`}>{n}</div>
        {IconCmp && <IconCmp size={16} className="text-muted/70 mt-0.5" />}
      </div>
      <div className="font-button text-[11px] font-medium text-muted uppercase tracking-[1.5px] mt-2">{label}</div>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="block bg-card border border-line rounded-md p-4 transition-colors duration-150 hover:border-berry active:scale-[0.99]">
        {inner}
      </Link>
    );
  }
  return <div className="bg-card border border-line rounded-md p-4">{inner}</div>;
}

export default function OccupantsView() {
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [q, setQ] = useState('');
  const [dupesOnly, setDupesOnly] = useState(false);

  // The occupant whose full record is open, or null.
  const [openGroup, setOpenGroup] = useState(null);
  // null = closed, seat object = confirming; seat carries occupantName for the copy
  const [toRelease, setToRelease] = useState(null);
  const [releaseBusy, setReleaseBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await api.get('/positions/occupants');
      setData(d);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function releaseSeat() {
    const s = toRelease;
    if (!s) return;
    setReleaseBusy(true);
    try {
      await api.post(`/positions/${s.id}/hand-back`);
      toast(`Seat ${s.pcn} handed back — Under Recruitment`);
      await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setReleaseBusy(false);
      setToRelease(null);
    }
  }

  const filtered = useMemo(() => {
    let groups = data?.occupants || [];
    if (dupesOnly) groups = groups.filter((g) => g.seat_count > 1);
    const needle = q.trim().toLowerCase();
    if (needle) {
      groups = groups.filter(
        (g) => g.name.toLowerCase().includes(needle)
          || g.seats.some((s) => s.pcn.toLowerCase().includes(needle) || s.designation.toLowerCase().includes(needle))
      );
    }
    return groups;
  }, [data, q, dupesOnly]);

  const totals = data?.totals || {};
  const anyFilter = q || dupesOnly;

  if (loading) {
    return (
      <div>
        <TileSkeleton count={6} />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        <Stat n={totals.filled_seats ?? 0} label="Filled Seats" icon={CheckCircle} to="/register?status=Filled" />
        <Stat n={totals.occupants ?? 0} label="Occupants" icon={Users} />
        <Stat n={totals.joined ?? 0} label="Joined" icon={UserCheck} />
        <Stat
          n={totals.awaiting_joining ?? 0}
          label="Awaiting Joining"
          icon={Clock}
          tone={totals.awaiting_joining > 0 ? 'amber' : undefined}
        />
        <Stat
          n={totals.over_band ?? 0}
          label="Hired Over Band"
          icon={AlertTriangle}
          tone={totals.over_band > 0 ? 'red' : undefined}
        />
        <Stat
          n={totals.multi_seat_occupants ?? 0}
          label="Holding >1 Seat"
          icon={AlertTriangle}
          tone={totals.multi_seat_occupants > 0 ? 'red' : undefined}
        />
      </div>

      <div className="card">
        <div className="infobar">
          <b>One person holds exactly one PCN.</b> A seat marked <b>no application linked</b> has an occupant name
          recorded but no Selected candidate behind it — either staff seeded before this system, or a seat stranded
          by an old double-select. When the same name appears on several seats, hand back the unlinked one(s);
          the seat returns to Under Recruitment and the occupant name is cleared.
        </div>

        <div className="flex gap-2 flex-wrap items-center mb-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              className="inp w-auto min-w-[230px] pl-8"
              placeholder="Search occupant / PCN / designation…"
              aria-label="Search occupants"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <label className="inline-flex items-center gap-1.5 text-[12.5px] text-body cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dupesOnly}
              onChange={(e) => setDupesOnly(e.target.checked)}
            />
            Holding more than one seat only
          </label>
          {anyFilter && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setDupesOnly(false); }}>
              <X size={12} />
              Clear
            </button>
          )}
          <span className="mini tabular-nums ml-auto">
            Showing {filtered.length} of {totals.occupants ?? 0} occupants
          </span>
        </div>

        <ErrorBox error={err} onRetry={load} />

        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Occupant</th><th>PCN (seat)</th><th>Designation</th><th>Dept</th><th>Grade</th>
                <th className="num">Salary Band ₹/mo</th><th className="num">Hired At</th><th>Selection</th><th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <Empty
                      icon={anyFilter ? Inbox : UserCheck}
                      title={anyFilter ? 'No occupants match' : 'No filled seats yet'}
                      action={
                        anyFilter ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setDupesOnly(false); }}>
                            Clear filters
                          </button>
                        ) : null
                      }
                    >
                      {anyFilter
                        ? 'Try widening the search or clearing the duplicate filter.'
                        : 'Occupants appear here once positions are Filled through selection.'}
                    </Empty>
                  </td>
                </tr>
              ) : (
                filtered.map((g) => g.seats.map((s, i) => (
                  <tr key={s.id} className={g.seat_count > 1 ? 'row-alert' : undefined}>
                    {i === 0 && (
                      <td rowSpan={g.seats.length} className="align-top">
                        <div className="font-semibold text-ink">
                          {g.name || <span className="mini font-normal">no name recorded</span>}
                        </div>
                        {g.seat_count > 1 && (
                          <div className="mt-1">
                            <FlagPill tone="amber">{g.seat_count} seats</FlagPill>
                          </div>
                        )}
                      </td>
                    )}
                    <td className="pcn">{s.pcn}</td>
                    <td>{s.designation}</td>
                    <td>{s.department}</td>
                    <td>{s.grade}</td>
                    <td className="num whitespace-nowrap">{band(s.salary_min, s.salary_max)}</td>
                    <td className="num whitespace-nowrap">
                      {s.application?.offered_salary == null ? (
                        <span className="mini">—</span>
                      ) : (
                        <>
                          {inr(s.application.offered_salary)}
                          {s.application.band_standing && (
                            <div className="mt-1"><BandPill standing={s.application.band_standing} /></div>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      {s.application ? (
                        <>
                          <JoiningPill status={s.application.joining_status} />
                          <div className="mini font-mono mt-1">{s.application.reference_id}</div>
                          {s.application.date_of_joining && (
                            <div className="mini">DOJ {fmtDate(s.application.date_of_joining)}</div>
                          )}
                        </>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-sm text-[11px] font-semibold uppercase tracking-[1px] bg-muted/12 text-muted whitespace-nowrap">
                          No application linked
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="flex gap-1.5 flex-wrap">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setOpenGroup(g)}
                          title="Open the full record for this person"
                        >
                          View
                        </button>
                        {!s.application && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setToRelease({ ...s, occupantName: g.name })}
                            title="Return this seat to Under Recruitment and clear the occupant"
                          >
                            Hand back
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                )))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openGroup && (
        <OccupantDrawer group={openGroup} onClose={() => setOpenGroup(null)} />
      )}

      {toRelease && (
        <ConfirmDialog
          title="Hand back this seat?"
          body={
            <>
              Seat <b className="font-mono">{toRelease.pcn}</b> ({toRelease.designation}) currently shows{' '}
              <b>{toRelease.occupantName || 'no occupant name'}</b> with no Selected application behind it.
              Handing it back sets the seat to <b>Under Recruitment</b> and clears the occupant name.
              No application or candidate record is touched.
            </>
          }
          confirmLabel="Hand back"
          tone="danger"
          busy={releaseBusy}
          onCancel={() => setToRelease(null)}
          onConfirm={releaseSeat}
        />
      )}
    </div>
  );
}
