import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { band } from '../lib/format';
import { ErrorBox, Empty, TileSkeleton, CardSkeleton } from '../components/LoadState';
import { StatusPill, FlagPill } from '../components/Badges';
import PageHeader from '../components/PageHeader';
import {
  Building, CheckCircle, Clock, AlertCircle, Calendar, AlertTriangle, Flag, Inbox,
} from '../components/Icons';

const ALL_STATUSES = ['Filled', 'Under Recruitment', 'Vacant', 'Frozen', 'On Hold', 'Contract', 'Outsourced', 'Eliminated'];

function Stat({ n, label, tone, icon: IconCmp, to, hint }) {
  // Quiet editorial tiles: serif black numbers; red is reserved for alerts (Past SLA / red flags).
  const color = tone === 'red' ? 'text-brand-red' : 'text-ink';
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={`font-display text-[30px] font-semibold leading-none tabular-nums ${color}`}>{n}</div>
        {IconCmp && <IconCmp size={16} className="text-muted/70 mt-0.5" />}
      </div>
      <div className="font-button text-[11px] font-medium text-muted uppercase tracking-[1.5px] mt-2">{label}</div>
      {hint && <div className="text-[10.5px] text-muted/80 mt-1 leading-snug">{hint}</div>}
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="block bg-card border border-line rounded-md p-4 transition-colors duration-150 hover:border-berry active:scale-[0.99]"
      >
        {inner}
      </Link>
    );
  }
  return <div className="bg-card border border-line rounded-md p-4">{inner}</div>;
}

/* The average only counts seats filled through a selection, because that is the
   only moment the vacancy-to-hire clock can be stopped. A seat occupied before
   this was tracked cannot be measured after the fact — vacant_since is cleared
   the instant a seat fills — so the tile says which case it is in rather than
   showing a bare dash. */
function fillHint(data) {
  if (data.filled_measured) {
    return `Vacancy to selection, across ${data.filled_measured} filled seat${data.filled_measured === 1 ? '' : 's'}`;
  }
  if (data.filled_unmeasured) {
    return `${data.filled_unmeasured} seat${data.filled_unmeasured === 1 ? ' was' : 's were'} filled before this was tracked — the next hire starts the average`;
  }
  return 'Starts once a candidate is selected into a seat';
}

function OccupancyBar({ filled, total }) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 mt-1" title={`${filled} of ${total} seats filled`}>
      <div className="occ-track" role="img" aria-label={`${filled} of ${total} seats filled`}>
        <div className="occ-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="mini tabular-nums">{pct}%</span>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const d = await api.get('/dashboard/summary');
      setData(d);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const header = (
    <PageHeader title="Dashboard" sub="Recruitment & position control at a glance" />
  );

  if (loading) {
    return (
      <div>
        {header}
        <TileSkeleton count={8} />
        <CardSkeleton lines={4} />
        <CardSkeleton lines={6} />
      </div>
    );
  }
  if (err) return <div>{header}<ErrorBox error={err} onRetry={load} /></div>;
  if (!data) return null;

  const by = data.by_status || {};
  const deptTotals = (data.departments || []).reduce(
    (acc, d) => ({
      total: acc.total + d.total,
      filled: acc.filled + d.filled,
      under: acc.under + d.under_recruitment,
      vacant: acc.vacant + d.vacant,
      frozen: acc.frozen + d.frozen_or_hold,
      bandMin: acc.bandMin + (d.band_min || 0),
      bandMax: acc.bandMax + (d.band_max || 0),
    }),
    { total: 0, filled: 0, under: 0, vacant: 0, frozen: 0, bandMin: 0, bandMax: 0 }
  );

  return (
    <div>
      {header}

      {/* KPI tiles — clickable drill-downs into the register / red-flag queue */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-4">
        <Stat n={data.positions_total} label="Positions (PCNs)" icon={Building} to="/register" />
        <Stat n={by.Filled || 0} label="Filled" icon={CheckCircle} to="/register?status=Filled" />
        <Stat n={by['Under Recruitment'] || 0} label="Under Recruitment" icon={Clock} to={`/register?status=${encodeURIComponent('Under Recruitment')}`} />
        <Stat n={by.Vacant || 0} label="Vacant (idle)" icon={AlertCircle} to="/register?status=Vacant" />
        <Stat n={data.avg_days_vacant} label="Avg Days Unfilled" icon={Calendar} hint="Across Vacant and Under Recruitment seats" />
        <Stat
          n={data.filled_measured ? data.avg_days_to_fill : '—'}
          label="Avg Days to Fill"
          icon={Clock}
          hint={fillHint(data)}
        />
        <Stat n={data.sla_breached_count} label="Past SLA" icon={AlertTriangle} tone={data.sla_breached_count > 0 ? 'red' : undefined} to="/register?breached=1" />
        <Stat n={data.red_flag_queue_count} label="Red-Flag Queue" icon={Flag} tone={data.red_flag_queue_count > 0 ? 'red' : undefined} to="/red-flags" />
      </div>

      {/* Vacancy status breakdown */}
      <div className="card">
        <h2 className="card-h">Vacancy Status Breakdown <span className="r">every sanctioned position carries one status</span></h2>
        <div className="flex gap-4 flex-wrap">
          {ALL_STATUSES.map((s) => (
            <div key={s} className="text-center min-w-[90px]">
              <div className="font-display text-[26px] font-semibold text-ink leading-none mb-1.5 tabular-nums">{by[s] || 0}</div>
              <StatusPill status={s} />
            </div>
          ))}
        </div>
      </div>

      {/* Aging vacancies */}
      <div className="card">
        <h2 className="card-h">Aging Vacancies <span className="r">days unfilled vs. replacement SLA</span></h2>
        <div className="infobar">
          Counts days a seat has gone <b>unfilled</b> — both Vacant and Under Recruitment count, because a seat with a search running is still an empty seat. Rows past their replacement SLA are flagged — a critical seat unfilled beyond SLA is the real cost, not the count.
        </div>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Job Code</th><th>Designation</th><th>Dept</th><th>Grade</th><th>Status</th>
                <th className="num">Days Unfilled</th><th className="num">Repl. SLA</th><th>Status vs SLA</th>
              </tr>
            </thead>
            <tbody>
              {(data.aging_vacancies || []).length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <Empty icon={Inbox} title="No aging vacancies">
                      No positions are currently sitting unfilled (Vacant or Under Recruitment).
                    </Empty>
                  </td>
                </tr>
              ) : (
                data.aging_vacancies.map((v) => (
                  <tr key={v.pcn} className={v.sla_breached ? 'row-alert' : undefined}>
                    <td className="pcn text-ink">{v.job_code}</td>
                    <td>{v.designation} {v.is_critical && <FlagPill tone="amber">Critical</FlagPill>}</td>
                    <td>{v.department}</td>
                    <td>{v.grade}</td>
                    <td><StatusPill status={v.status} /></td>
                    <td className={`num font-bold ${v.sla_breached ? 'text-brand-red' : 'text-ink'}`}>{v.days_vacant} days</td>
                    <td className="num">{v.replacement_sla_days != null ? `${v.replacement_sla_days} days` : '—'}</td>
                    <td>
                      {v.sla_breached ? (
                        <span className="inline-block px-2 py-0.5 rounded-sm text-[11px] font-semibold uppercase tracking-[1px] bg-brand-red/10 text-brand-red tabular-nums">
                          Over by {v.days_vacant - v.replacement_sla_days}d
                        </span>
                      ) : v.replacement_sla_days != null ? (
                        <span className="inline-block px-2 py-0.5 rounded-sm text-[11px] font-semibold uppercase tracking-[1px] bg-brand-green/10 text-brand-green">Within SLA</span>
                      ) : (
                        <span className="mini">no SLA set</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manpower by department */}
      <div className="card">
        <h2 className="card-h">Manpower by Department <span className="r">sanctioned band {band(data.band_min_total, data.band_max_total)}/mo (excl. Eliminated)</span></h2>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Department</th><th className="num">Positions</th><th className="num">Filled</th><th className="num">Under Recruitment</th>
                <th className="num">Vacant (idle)</th><th className="num">Frozen/Hold</th><th className="num">Salary Band ₹/mo</th>
              </tr>
            </thead>
            <tbody>
              {(data.departments || []).map((d) => (
                <tr key={d.department}>
                  <td>
                    {d.department}
                    <OccupancyBar filled={d.filled} total={d.total} />
                  </td>
                  <td className="num">{d.total}</td>
                  <td className="num text-brand-green font-bold">{d.filled}</td>
                  <td className="num text-brand-amber">{d.under_recruitment}</td>
                  <td className="num text-brand-red font-bold">{d.vacant}</td>
                  <td className="num">{d.frozen_or_hold}</td>
                  <td className="num whitespace-nowrap">{band(d.band_min, d.band_max)}</td>
                </tr>
              ))}
              {(data.departments || []).length > 0 && (
                <tr className="font-bold">
                  <td>Total</td>
                  <td className="num">{deptTotals.total}</td>
                  <td className="num text-brand-green">{deptTotals.filled}</td>
                  <td className="num text-brand-amber">{deptTotals.under}</td>
                  <td className="num text-brand-red">{deptTotals.vacant}</td>
                  <td className="num">{deptTotals.frozen}</td>
                  <td className="num whitespace-nowrap">{band(deptTotals.bandMin, deptTotals.bandMax)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
