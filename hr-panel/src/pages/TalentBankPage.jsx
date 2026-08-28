import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { inr, fmtDate } from '../lib/format';
import { exportCSV, stamp } from '../lib/export';
import { ErrorBox, Empty, TableSkeleton } from '../components/LoadState';
import { StageBadge } from '../components/Badges';
import ApplicantDrawer from '../components/ApplicantDrawer';
import PageHeader from '../components/PageHeader';
import { Search, X, Briefcase, Download } from '../components/Icons';
import { useToast } from '../context/ToastContext';

/* The Talent Bank — candidates who were not selected (Not Shortlisted or
   Rejected) but are worth keeping on file for a future vacancy. Banking is a
   flag on the application, so each row still carries its full history. A banked
   candidate with NO scored interview re-enters through "Move role"; one whose
   rounds were scored applies afresh (scores made on one role's scorecard cannot
   carry to another), with the banked record keeping the history. */

const BANK_CSV = [
  { header: 'Reference', value: (a) => a.reference_id },
  { header: 'Candidate', value: (a) => a.candidate_name },
  { header: 'Mobile', value: (a) => a.mobile },
  { header: 'Email', value: (a) => a.email },
  { header: 'Applied For', value: (a) => a.designation },
  { header: 'Department', value: (a) => a.department },
  { header: 'Grade', value: (a) => a.grade },
  { header: 'Experience (yrs)', value: (a) => a.total_experience_years ?? '' },
  { header: 'Hotel Experience (yrs)', value: (a) => a.relevant_hotel_experience_years ?? '' },
  { header: 'Expected Salary', value: (a) => a.expected_salary ?? '' },
  { header: 'Outcome', value: (a) => a.stage },
  // The reason belongs to a Rejected outcome — a candidate later parked at
  // another stage would otherwise export a stale reason from an earlier phase.
  { header: 'Reason', value: (a) => (a.stage === 'Rejected' ? a.rejection_reason || '' : '') },
  { header: 'Banked On', value: (a) => fmtDate(a.talent_bank?.added_at) },
  { header: 'Banked By', value: (a) => a.talent_bank?.added_by_name || '' },
  { header: 'Note', value: (a) => a.talent_bank?.note || '' },
];

export default function TalentBankPage() {
  const toast = useToast();

  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [openId, setOpenId] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(null); // id being removed

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await api.get('/applications?talent_bank=true');
      setApps(d.applications || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function removeFromBank(a) {
    setRemoveBusy(a.id);
    try {
      await api.del(`/applications/${a.id}/talent-bank`);
      toast(`${a.candidate_name} removed from the Talent Bank`);
      await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setRemoveBusy(null);
    }
  }

  const departments = useMemo(
    () => [...new Set(apps.map((a) => a.department).filter(Boolean))].sort(),
    [apps]
  );

  const displayed = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return apps.filter((a) => {
      if (dept && a.department !== dept) return false;
      if (!needle) return true;
      return [a.candidate_name, a.designation, a.reference_id, a.qualification]
        .some((s) => String(s || '').toLowerCase().includes(needle));
    });
  }, [apps, q, dept]);

  const anyFilter = q || dept;

  const header = (
    <PageHeader
      title="Talent Bank"
      sub="Not selected, worth keeping · on file for the next vacancy"
    />
  );

  if (loading) {
    return <div>{header}<TableSkeleton rows={6} /></div>;
  }

  return (
    <div>
      {header}

      <div className="card">
        <div className="infobar">
          <b>The bank is a flag, not a copy.</b> Each row is the candidate's own application with its full
          history. To bring back a candidate whose interview was never scored, open the record and use{' '}
          <b>Move role</b> — the application re-enters the pipeline against the new post and leaves the bank
          automatically. A candidate rejected <i>after</i> scored interviews cannot be moved (those scores
          belong to the old role's scorecard) — invite them to apply afresh; this record keeps the history.
        </div>

        <div className="flex gap-2 flex-wrap items-center mb-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              className="inp w-auto min-w-[230px] pl-8"
              placeholder="Search name / role / ref…"
              aria-label="Search talent bank"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className="inp w-auto min-w-[160px]" aria-label="Filter by department" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
          {anyFilter && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setDept(''); }}>
              <X size={12} />
              Clear
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm ml-auto"
            onClick={() => exportCSV(`talent-bank-${stamp()}.csv`, BANK_CSV, displayed)}
            disabled={displayed.length === 0}
            title="Download the talent bank as a CSV spreadsheet"
          >
            <Download size={13} />
            Export CSV
          </button>
          <span className="mini tabular-nums">Showing {displayed.length} of {apps.length} candidates</span>
        </div>

        <ErrorBox error={err} onRetry={load} />

        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Candidate</th><th>Applied For</th><th className="num">Exp</th>
                <th className="num">Expected ₹/mo</th><th>Outcome</th><th>Banked</th><th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <Empty
                      icon={Briefcase}
                      title={anyFilter ? 'No banked candidates match' : 'The Talent Bank is empty'}
                      action={
                        anyFilter ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setDept(''); }}>
                            Clear filters
                          </button>
                        ) : null
                      }
                    >
                      {anyFilter
                        ? 'Try a different search term or department.'
                        : 'Open a Not Shortlisted or Rejected application and use "Send to Talent Bank" to keep the candidate on file.'}
                    </Empty>
                  </td>
                </tr>
              ) : (
                displayed.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <b>{a.candidate_name}</b>
                      <div className="mini font-mono">{a.reference_id}</div>
                      <div className="mini">{a.mobile}</div>
                    </td>
                    <td>
                      {a.designation}
                      <div className="mini">{a.department}{a.grade ? ` · ${a.grade}` : ''}</div>
                    </td>
                    <td className="num">
                      {a.total_experience_years ?? '—'}y
                      {a.relevant_hotel_experience_years != null && (
                        <div className="mini whitespace-nowrap">{a.relevant_hotel_experience_years}y hotels</div>
                      )}
                    </td>
                    <td className="num whitespace-nowrap">{a.expected_salary != null ? inr(a.expected_salary) : <span className="mini">—</span>}</td>
                    <td>
                      <StageBadge stage={a.stage} />
                      {a.stage === 'Rejected' && a.rejection_reason && <div className="mini">{a.rejection_reason}</div>}
                    </td>
                    <td>
                      <div className="whitespace-nowrap">{fmtDate(a.talent_bank?.added_at)}</div>
                      {a.talent_bank?.added_by_name && <div className="mini">by {a.talent_bank.added_by_name}</div>}
                      {a.talent_bank?.note && <div className="mini break-words max-w-[220px]">{a.talent_bank.note}</div>}
                    </td>
                    <td>
                      <span className="flex gap-1.5 flex-wrap">
                        <button type="button" className="btn btn-sm" onClick={() => setOpenId(a.id)}>Open</button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => removeFromBank(a)}
                          disabled={removeBusy === a.id}
                          title="Take this candidate back out of the Talent Bank"
                        >
                          {removeBusy === a.id ? 'Removing…' : 'Remove'}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
