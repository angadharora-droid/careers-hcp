import { Card, PageHeader, RecChip, tdCls, thCls } from '../components/ui';
import { IconUsers } from '../components/Icons';

function WeightCell({ pct }) {
  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums font-semibold text-ink w-9 shrink-0">{pct}%</span>
      <span
        aria-hidden="true"
        className="hidden sm:block h-1.5 w-20 bg-beige rounded-full overflow-hidden"
      >
        <span className="block h-full bg-berry rounded-full" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

export default function Framework() {
  return (
    <>
      <PageHeader
        title="Framework & Guide"
        sub="How the behaviourally anchored scorecard works — weights, levels, interpretation bands and panel composition."
      />

      <Card title="Scoring Framework">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={thCls}>Section</th>
                <th className={thCls}>Weight</th>
                <th className={thCls}>Competencies</th>
                <th className={thCls}>Why it's weighted this way</th>
              </tr>
            </thead>
            <tbody>
              <tr className="even:bg-cream/50 hover:bg-beige/40 transition-colors duration-150">
                <td className={tdCls}>
                  <b>Attitude</b>
                </td>
                <td className={tdCls}>
                  <WeightCell pct={60} />
                </td>
                <td className={tdCls}>
                  Guest Orientation, Cultural Fit, Communication, Learning &amp; Teamwork
                </td>
                <td className={tdCls}>
                  Per CHR brief: attitude &amp; behaviour predict hospitality success more than
                  technical knowledge, which can be trained.
                </td>
              </tr>
              <tr className="even:bg-cream/50 hover:bg-beige/40 transition-colors duration-150">
                <td className={tdCls}>
                  <b>Skills</b>
                </td>
                <td className={tdCls}>
                  <WeightCell pct={25} />
                </td>
                <td className={tdCls}>
                  Practical assessment, Problem Solving, Grooming &amp; Presence, PMS/Computer
                </td>
                <td className={tdCls}>
                  Demonstrable ability the candidate should already have some of.
                </td>
              </tr>
              <tr className="even:bg-cream/50 hover:bg-beige/40 transition-colors duration-150">
                <td className={tdCls}>
                  <b>Knowledge</b>
                </td>
                <td className={tdCls}>
                  <WeightCell pct={15} />
                </td>
                <td className={tdCls}>Role Knowledge, Hospitality Awareness</td>
                <td className={tdCls}>Lowest weight — most teachable during induction.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="bg-beige/40 border-l-2 border-berry px-4 py-2.5 text-xs text-body rounded-r-sm mt-3">
          <b>Every competency is scored by behavioural MCQ, never a bare number.</b> The five
          levels map to Exceptional 100% · Strong 80% · Acceptable 60% · Below Expectations 40% ·
          Not Suitable 20% of that competency's weight.
        </div>
      </Card>

      <Card title="Score Interpretation">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={thCls}>Weighted Score</th>
                <th className={thCls}>Recommendation</th>
                <th className={thCls}>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr className="even:bg-cream/50 hover:bg-beige/40 transition-colors duration-150">
                <td className={`${tdCls} tabular-nums`}>85–100</td>
                <td className={tdCls}>
                  <RecChip rec="Strongly Recommend" />
                </td>
                <td className={tdCls}>
                  Ready for immediate hiring, aligned with CP service culture.
                </td>
              </tr>
              <tr className="even:bg-cream/50 hover:bg-beige/40 transition-colors duration-150">
                <td className={`${tdCls} tabular-nums`}>70–84</td>
                <td className={tdCls}>
                  <RecChip rec="Recommend" />
                </td>
                <td className={tdCls}>Suitable with routine induction and training.</td>
              </tr>
              <tr className="even:bg-cream/50 hover:bg-beige/40 transition-colors duration-150">
                <td className={`${tdCls} tabular-nums`}>55–69</td>
                <td className={tdCls}>
                  <RecChip rec="Hold" />
                </td>
                <td className={tdCls}>
                  Potential, but needs further assessment or reference checks.
                </td>
              </tr>
              <tr className="even:bg-cream/50 hover:bg-beige/40 transition-colors duration-150">
                <td className={`${tdCls} tabular-nums`}>Below 55</td>
                <td className={tdCls}>
                  <RecChip rec="Do Not Recommend" />
                </td>
                <td className={tdCls}>Did not meet behavioural standards for the role.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="text-[11px] text-muted mt-2">
          <b>Red-flag override:</b> any integrity/attitude red flag routes to HR review regardless
          of numeric score.
        </div>
      </Card>

      <Card title="Panel Composition Rule">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="border border-line rounded-sm p-4 bg-cream/40">
            <div className="flex items-center gap-2 mb-1">
              <IconUsers size={17} className="text-berry" />
              <h3 className="font-display text-base font-semibold text-ink">2-member panel</h3>
            </div>
            <div className="font-button text-[11px] uppercase tracking-[1.5px] text-muted mb-1.5">
              Grades B &amp; C — non-manager roles
            </div>
            <p className="text-[12.5px]">
              Two independent panellists, each scoring separately on their own device or sheet.
            </p>
          </div>
          <div className="border border-line rounded-sm p-4 bg-cream/40">
            <div className="flex items-center gap-2 mb-1">
              <IconUsers size={17} className="text-berry" />
              <h3 className="font-display text-base font-semibold text-ink">
                3-member committee
              </h3>
            </div>
            <div className="font-button text-[11px] uppercase tracking-[1.5px] text-muted mb-1.5">
              Grades A1–A3 — manager roles
            </div>
            <p className="text-[12.5px]">
              GM, Ops Manager, Admin Head, Executive Chef roles are interviewed by a committee of
              three, each scoring independently.
            </p>
          </div>
        </div>
        <p className="text-[11.5px] text-muted mt-3">
          Scores are compared, never merged during the interview — divergence is a discussion
          trigger, not an averaging problem.
        </p>
      </Card>
    </>
  );
}
