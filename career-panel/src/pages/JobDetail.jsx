import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPosition, getPositions } from '../lib/api';
import JobCard from '../components/JobCard';
import { friendlyLevel } from '../lib/format';
import DescriptionBlocks from '../components/DescriptionBlocks';
import ErrorAlert from '../components/ErrorAlert';
import RoleClosed from '../components/RoleClosed';
import { DetailSkeleton } from '../components/Skeleton';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  BuildingIcon,
  ClockIcon,
  MapPinIcon,
  UserIcon,
  UsersIcon,
} from '../components/Icons';

function Fact({ icon: IconComponent, label, value }) {
  return (
    <div className="flex gap-3 py-3">
      <IconComponent size={16} className="shrink-0 mt-0.5 text-muted" />
      <div className="min-w-0">
        <dt className="font-button text-[11px] uppercase tracking-[1.5px] text-muted">{label}</dt>
        <dd className="mt-0.5 text-[13.5px] font-medium text-ink leading-snug">{value || '—'}</dd>
      </div>
    </div>
  );
}

export default function JobDetail() {
  const { job_code } = useParams();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    setClosed(false);
    getPosition(job_code)
      .then((data) => setRole(data.role))
      .catch((e) => {
        if (e.status === 404) setClosed(true);
        else setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [job_code]);

  useEffect(() => {
    load();
  }, [load]);

  // Other open roles — same department first (silent failure: section simply hides)
  const [allRoles, setAllRoles] = useState(null);
  useEffect(() => {
    let live = true;
    getPositions()
      .then((data) => live && setAllRoles(data.roles || []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [job_code]);

  const related = useMemo(() => {
    if (!allRoles || !role) return [];
    const rest = allRoles.filter((r) => r.job_code !== role.job_code);
    const sameDept = rest.filter((r) => r.department === role.department);
    const others = rest.filter((r) => r.department !== role.department);
    return [...sameDept, ...others].slice(0, 3);
  }, [allRoles, role]);

  const applyTo = `/jobs/${encodeURIComponent(job_code)}/apply`;

  return (
    <div className="pb-28 lg:pb-10">
      {/* Photo banner with back link + role header */}
      <div className="relative h-[220px] sm:h-[250px] overflow-hidden">
        <img
          src="/img/facade.jpg"
          alt=""
          width="2560"
          height="1920"
          loading="eager"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/40 to-black/30"
          aria-hidden="true"
        />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 h-full flex flex-col justify-between py-5">
          <Link
            to="/"
            className="self-start inline-flex items-center gap-2 min-h-[44px] sm:min-h-0 font-button text-[11px] uppercase tracking-[2px] text-white/90 hover:text-white transition-colors duration-200"
          >
            <ArrowLeftIcon size={14} />
            All openings
          </Link>
          {!loading && !error && !closed && role && (
            <div>
              <p className="font-button text-[11px] uppercase tracking-[2px] text-cream/90">
                {[role.department, friendlyLevel(role.grade_label)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <h1 className="mt-1.5 font-display text-3xl sm:text-4xl font-semibold text-white leading-tight">
                {role.designation}
              </h1>
              <p className="mt-1.5 text-xs text-cream/80">
                Job code: <span className="font-mono font-bold text-white">{role.job_code}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {loading && <DetailSkeleton />}
        {!loading && error && <ErrorAlert message={error} onRetry={load} />}
        {!loading && closed && <RoleClosed />}

        {!loading && !error && !closed && role && (
          <>
            <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-6 lg:items-start">
              {/* Left: full description */}
            <div className="bg-card border border-line rounded-sm p-5 sm:p-7">
              <h2 className="font-display text-xl font-semibold text-ink">About this role</h2>
              <span className="mt-2 mb-5 block h-0.5 w-8 bg-berry" aria-hidden="true" />
              <DescriptionBlocks text={role.job_description} />
            </div>

            {/* Right: sticky role facts */}
            <aside className="mt-5 lg:mt-0 lg:sticky lg:top-24 bg-card border border-line rounded-sm p-5 sm:p-6">
              <h2 className="font-display text-lg font-semibold text-ink border-b border-line pb-3">
                Role facts
              </h2>
              <dl className="divide-y divide-line">
                <Fact icon={BuildingIcon} label="Department" value={role.department} />
                <Fact icon={BriefcaseIcon} label="Level" value={role.grade_label} />
                <Fact icon={UserIcon} label="Reports to" value={role.reports_to} />
                <Fact
                  icon={MapPinIcon}
                  label="Location"
                  value={[role.unit, role.location].filter(Boolean).join(' · ')}
                />
                <Fact
                  icon={UsersIcon}
                  label="Openings"
                  value={
                    role.openings > 1 ? (
                      <span>
                        {role.openings} openings{' '}
                        <span className="ml-1 font-button text-[11px] uppercase tracking-[1.5px] text-berry">
                          hiring now
                        </span>
                      </span>
                    ) : (
                      '1 opening'
                    )
                  }
                />
              </dl>
              <Link
                to={applyTo}
                className="mt-4 w-full inline-flex items-center justify-center min-h-[44px] bg-berry text-white font-button text-xs uppercase tracking-[2px] font-medium px-6 py-2.5 rounded-sm hover:bg-berry-dark active:scale-[0.98] transition duration-200"
              >
                Apply for this role
              </Link>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-muted">
                <ClockIcon size={13} className="shrink-0" />
                The application takes about five minutes
              </p>
            </aside>
            </div>

            {/* More openings */}
            {related.length > 0 && (
              <section className="mt-12">
                <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3 mb-5">
                  <h2 className="font-display text-2xl font-semibold text-ink">More openings</h2>
                  <Link
                    to="/"
                    className="font-button text-[11px] uppercase tracking-[2px] text-berry hover:text-berry-dark whitespace-nowrap"
                  >
                    View all
                  </Link>
                </div>
                <div className="flex flex-col gap-4">
                  {related.map((r, i) => (
                    <JobCard key={r.job_code} role={r} index={i} as="h3" />
                  ))}
                </div>
              </section>
            )}

            {/* Mobile sticky apply bar */}
            <div
              className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-card border-t border-line"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
                <p className="min-w-0 flex-1 font-display text-base font-semibold text-ink leading-tight truncate">
                  {role.designation}
                </p>
                <Link
                  to={applyTo}
                  className="shrink-0 inline-flex items-center justify-center min-h-[44px] bg-berry text-white font-button text-xs uppercase tracking-[2px] font-medium px-6 rounded-sm hover:bg-berry-dark active:scale-[0.98] transition duration-200"
                >
                  Apply
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
