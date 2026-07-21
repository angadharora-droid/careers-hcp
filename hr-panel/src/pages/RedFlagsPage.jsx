import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { ErrorBox, Empty, Skeleton } from '../components/LoadState';
import { StageBadge, RecChip } from '../components/Badges';
import ApplicantDrawer from '../components/ApplicantDrawer';
import PageHeader from '../components/PageHeader';
import { Flag } from '../components/Icons';

function QueueSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border border-line bg-card rounded-md p-4">
          <Skeleton className="h-5 w-1/2 mb-2" />
          <Skeleton className="h-3.5 w-2/3 mb-1.5" />
          <Skeleton className="h-3.5 w-1/3 mb-3" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

export default function RedFlagsPage() {
  const [items, setItems] = useState([]); // [{ app, flaggers: [{panelist_name, panel_role, red_flags, total_score}] }]
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await api.get('/applications?red_flag=true');
      const apps = d.applications || [];
      // Who flagged + which flags come from the shared scores read.
      const withScores = await Promise.all(
        apps.map(async (app) => {
          try {
            const s = await api.get(`/applications/${app.id}/scores`);
            return { app, flaggers: (s.scores || []).filter((x) => (x.red_flags || []).length > 0) };
          } catch {
            return { app, flaggers: [] };
          }
        })
      );
      setItems(withScores);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Red-Flag Queue"
        sub="A panellist's flag overrides the average — HR reviews the evidence"
      />

      <div className="card">
        <h2 className="card-h">Flagged Candidates <span className="r">{items.length} candidate{items.length === 1 ? '' : 's'}</span></h2>
        <div className="infobar">
          <b>Any red flag routes here for HR review regardless of numeric score.</b> A panellist's flag (dishonesty, cultural misfit, grooming…) overrides the average — review the evidence before moving the candidate forward.
        </div>

        <ErrorBox error={err} onRetry={load} />
        {loading ? (
          <QueueSkeleton />
        ) : items.length === 0 ? (
          <Empty icon={Flag} title="No red-flagged candidates">
            When any panellist raises a red flag during scoring, the candidate appears here for HR review.
          </Empty>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map(({ app, flaggers }) => (
              <div key={app.id} className="border border-brand-red/40 bg-card rounded-md p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-bold text-[13.5px]">{app.candidate_name}</div>
                    <div className="mini"><span className="pcn">{app.job_code}</span> · {app.designation}</div>
                    <div className="mini">applied {fmtDate(app.applied_on)}</div>
                  </div>
                  <StageBadge stage={app.stage} />
                </div>

                <div className="mt-2 text-xs">
                  {app.score_summary?.count ? (
                    <span className="tabular-nums">
                      Panel avg <b>{app.score_summary.average}</b>/100 ({app.score_summary.count}/{app.score_summary.needed}){' '}
                      <RecChip rec={app.score_summary.recommendation} />
                    </span>
                  ) : (
                    <span className="mini">No scores yet.</span>
                  )}
                </div>

                <div className="mt-2">
                  {flaggers.length === 0 ? (
                    <div className="mini">Flag details unavailable.</div>
                  ) : (
                    flaggers.map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-brand-red font-semibold py-0.5">
                        <Flag size={12} className="mt-0.5 shrink-0" />
                        <span>
                          {f.panelist_name} ({f.panel_role}): {f.red_flags.join(', ')}
                          <span className="text-muted font-normal"> — scored {f.total_score}/100</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <button type="button" className="btn btn-sm mt-2.5" onClick={() => setOpenId(app.id)}>Open</button>
              </div>
            ))}
          </div>
        )}
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
