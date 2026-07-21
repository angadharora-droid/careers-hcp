import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPositions } from '../lib/api';
import JobCard from '../components/JobCard';
import ErrorAlert from '../components/ErrorAlert';
import { JobCardSkeleton, SkeletonBlock } from '../components/Skeleton';
import { SearchIcon } from '../components/Icons';
import Reveal from '../components/Reveal';

function matchesQuery(role, q) {
  if (!q) return true;
  return [role.designation, role.department, role.job_family, role.grade_label, role.location, role.unit]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

function scrollToRoles() {
  const el = document.getElementById('open-positions');
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

function StatCell({ value, label }) {
  return (
    <div className="flex-1 px-4 sm:px-8 py-4">
      <p className="font-display text-2xl sm:text-3xl font-semibold text-ink leading-none tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 font-button text-[11px] uppercase tracking-[2px] text-muted">{label}</p>
    </div>
  );
}

function SectionHeader({ kicker, title, line }) {
  return (
    <header className="text-center max-w-2xl mx-auto">
      <div className="flex items-center justify-center gap-4">
        <span className="h-px w-10 sm:w-14 bg-berry/40" aria-hidden="true" />
        <p className="font-button text-[11px] uppercase tracking-[2px] text-berry">{kicker}</p>
        <span className="h-px w-10 sm:w-14 bg-berry/40" aria-hidden="true" />
      </div>
      <h2 className="mt-4 font-display text-3xl sm:text-4xl font-semibold text-ink leading-tight">
        {title}
      </h2>
      {line && <p className="mt-3 text-sm text-body leading-relaxed">{line}</p>}
    </header>
  );
}

function LifeCard({ src, width, height, alt, title, line }) {
  return (
    <figure className="group">
      <div className="aspect-[4/3] overflow-hidden rounded-sm border border-line">
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          className="w-full h-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover:scale-105"
        />
      </div>
      <figcaption className="mt-4">
        <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-[13px] text-body leading-relaxed">{line}</p>
      </figcaption>
    </figure>
  );
}

function Step({ n, title, line, delay }) {
  return (
    <Reveal as="li" delay={delay}>
      <p className="font-display text-4xl font-semibold text-berry/30 leading-none tabular-nums" aria-hidden="true">
        {n}
      </p>
      <h3 className="mt-3 font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-[13px] text-body leading-relaxed">{line}</p>
    </Reveal>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[40px] px-4 rounded-sm border font-button text-[11px] uppercase tracking-[1.5px] font-medium whitespace-nowrap transition-colors duration-200 ${
        active
          ? 'bg-berry-soft border-berry text-berry'
          : 'bg-card border-line text-body hover:border-berry hover:text-berry'
      }`}
    >
      {children}
    </button>
  );
}

export default function JobList() {
  const [roles, setRoles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dept, setDept] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getPositions()
      .then((data) => setRoles(data.roles || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 250ms search debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const departments = useMemo(() => {
    if (!roles) return [];
    return [...new Set(roles.map((r) => r.department).filter(Boolean))].sort();
  }, [roles]);

  // Roles matching the search only (chip counts stay live against the search)
  const searchFiltered = useMemo(() => {
    if (!roles) return [];
    return roles.filter((r) => matchesQuery(r, debouncedQuery));
  }, [roles, debouncedQuery]);

  const deptCounts = useMemo(() => {
    const counts = {};
    for (const r of searchFiltered) {
      if (r.department) counts[r.department] = (counts[r.department] || 0) + 1;
    }
    return counts;
  }, [searchFiltered]);

  const filtered = useMemo(
    () => searchFiltered.filter((r) => !dept || r.department === dept),
    [searchFiltered, dept]
  );

  // Openings grouped by department (alphabetical). The API already returns
  // roles senior-first, so insertion order within each department is kept.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const d = r.department || 'Other';
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const filtersActive = debouncedQuery !== '' || dept !== '';
  const clearFilters = () => {
    setQuery('');
    setDept('');
  };

  return (
    <div>
      {/* Full-bleed photographic hero */}
      <section className="relative flex items-center justify-center min-h-[480px] h-[68vh] max-h-[640px] overflow-hidden">
        <img
          src="/img/hero-1.jpg"
          alt=""
          width="2560"
          height="1707"
          loading="eager"
          fetchpriority="high"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/25"
          aria-hidden="true"
        />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="font-button text-[11px] uppercase tracking-[3px] text-cream">
            Careers at Centre Point
          </p>
          <h1 className="mt-5 font-display text-[44px] sm:text-[56px] lg:text-[64px] font-semibold text-white leading-[1.05]">
            Stay Centered. Build Your Career With Us.
          </h1>
          <p className="mt-5 text-sm sm:text-[15px] text-cream/90 leading-relaxed max-w-xl mx-auto">
            If you take pride in warm, genuine service, there is a place for you on our team —
            experience helps, but the right spirit matters more.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={scrollToRoles}
              className="inline-flex items-center justify-center min-h-[44px] bg-berry text-white font-button text-xs uppercase tracking-[2px] font-medium px-7 py-3 rounded-sm hover:bg-berry-dark active:scale-[0.98] transition duration-200"
            >
              View open positions
            </button>
          </div>
        </div>
      </section>

      {/* Slim stats band */}
      <section className="bg-cream border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-stretch divide-x divide-line text-center">
            <StatCell value={roles ? roles.length : '—'} label="Open roles" />
            <StatCell value={roles ? departments.length : '—'} label="Departments" />
            <div className="flex-1 px-4 sm:px-8 py-4 flex items-center justify-center">
              <p className="font-display text-[15px] sm:text-base italic text-body leading-snug">
                We hire for attitude, train for skill
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Life at Centre Point */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <Reveal>
          <SectionHeader
            kicker="Why join us"
            title="Life at Centre Point"
            line="A workplace that looks after its people the way it looks after its guests."
          />
        </Reveal>
        <div className="mt-10 grid gap-8 md:gap-6 md:grid-cols-3">
          <Reveal>
            <LifeCard
              src="/img/lobby.jpg"
              width="2560"
              height="1440"
              alt="The lobby at Centre Point"
              title="A property to be proud of"
              line="Work in spaces guests admire — and learn what it takes to keep them that way."
            />
          </Reveal>
          <Reveal delay={80}>
            <LifeCard
              src="/img/dining.jpg"
              width="2560"
              height="2560"
              alt="Dining at Centre Point"
              title="Craft that guests remember"
              line="From the kitchen to the table, every plate and pour is a chance to master your craft."
            />
          </Reveal>
          <Reveal delay={160}>
            <LifeCard
              src="/img/room.jpg"
              width="2560"
              height="1707"
              alt="A guest room at Centre Point"
              title="Standards that teach you the trade"
              line="Train to the detail — the habits you build here carry through a hospitality career."
            />
          </Reveal>
        </div>
      </section>

      {/* How we hire */}
      <section className="bg-card border-y border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <Reveal>
            <SectionHeader
              kicker="How we hire"
              title="A fair, simple process"
              line="Every application is reviewed by HR, and every interview is scored independently by a panel."
            />
          </Reveal>
          <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            <Step
              n="01"
              title="Apply online"
              line="About five minutes — just your details and your CV. No account needed."
            />
            <Step
              n="02"
              delay={80}
              title="HR review"
              line="Your application is screened against the role's requirements and shortlisted."
            />
            <Step
              n="03"
              delay={160}
              title="Panel interview"
              line="A structured conversation, scored independently by two to three panellists."
            />
            <Step
              n="04"
              delay={240}
              title="Offer & joining"
              line="Selected candidates receive an offer and join the Centre Point team."
            />
          </ol>
        </div>
      </section>

      {/* Open positions */}
      <section id="open-positions" className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 scroll-mt-24">
        <Reveal>
          <SectionHeader
            kicker="Open positions"
            title="Current Openings"
            line="Find the role that fits you, filter by department, and apply in about five minutes."
          />
        </Reveal>

        <div className="mt-10">
          {/* Filter toolbar — sticks below the header while browsing the list */}
          <div className="md:sticky md:top-[86px] z-10 bg-cream/95 md:backdrop-blur-sm pt-1 pb-4 border-b border-line/70 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search roles, e.g. front office, chef…"
                aria-label="Search open roles"
                className="w-full min-h-[44px] rounded-sm border border-line bg-card pl-9 pr-3 py-2.5 text-[16px] text-body placeholder:text-muted/70 focus:outline-none focus:border-berry"
              />
            </div>

            {/* Result count + clear filters */}
            {!loading && !error && roles && roles.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <p
                  aria-live="polite"
                  className="font-button text-[11px] uppercase tracking-[2px] text-muted"
                >
                  Showing {filtered.length} of {roles.length} role{roles.length === 1 ? '' : 's'}
                </p>
                {filtersActive && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="font-button text-[11px] uppercase tracking-[2px] text-berry hover:text-berry-dark underline underline-offset-4 decoration-berry/40 hover:decoration-berry-dark min-h-[44px] sm:min-h-0"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Department filter chips */}
          {loading ? (
            <div className="flex gap-2 mt-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-10 w-28" />
              ))}
            </div>
          ) : (
            !error &&
            roles &&
            roles.length > 0 && (
              <div
                className="flex gap-2 mt-4 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0"
                role="group"
                aria-label="Filter by department"
              >
                <FilterChip active={dept === ''} onClick={() => setDept('')}>
                  All
                  <span className="tabular-nums font-normal">({searchFiltered.length})</span>
                </FilterChip>
                {departments.map((d) => (
                  <FilterChip key={d} active={dept === d} onClick={() => setDept(d)}>
                    {d}
                    <span className="tabular-nums font-normal">({deptCounts[d] || 0})</span>
                  </FilterChip>
                ))}
              </div>
            )
          )}

          </div>

          {error && <ErrorAlert message={error} onRetry={load} />}

          {loading && (
            <div className="flex flex-col gap-4 mt-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <JobCardSkeleton key={i} />
              ))}
            </div>
          )}

          {!loading && !error && roles && roles.length === 0 && (
            <div className="bg-card border border-line rounded-sm p-12 text-center max-w-xl mx-auto mt-5">
              <SearchIcon size={26} className="mx-auto text-muted" />
              <h3 className="mt-4 font-display text-2xl font-semibold text-ink">
                No open roles right now
              </h3>
              <p className="mt-3 text-[13px] text-body leading-relaxed">
                We are not hiring at the moment, but new opportunities open through the year.
                Please check back soon — we would love to hear from you.
              </p>
            </div>
          )}

          {!loading && !error && roles && roles.length > 0 && filtered.length === 0 && (
            <div className="bg-card border border-line rounded-sm p-12 text-center max-w-xl mx-auto">
              <SearchIcon size={26} className="mx-auto text-muted" />
              <h3 className="mt-4 font-display text-xl font-semibold text-ink">
                No roles match your search
              </h3>
              <p className="mt-3 text-[13px] text-body">
                Try a different keyword or clear the filters to see all open positions.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center min-h-[44px] sm:min-h-[40px] mt-5 border border-ink text-ink font-button text-[11px] uppercase tracking-[2px] font-medium px-5 py-2 rounded-sm hover:border-berry hover:text-berry transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="flex flex-col gap-10">
              {grouped.map(([deptName, list]) => (
                <section key={deptName} aria-label={`${deptName} openings`}>
                  <div className="flex items-baseline gap-3 border-b border-line pb-2.5 mb-4">
                    <h3 className="font-display text-[21px] font-semibold text-ink">{deptName}</h3>
                    <span className="font-button text-[11px] uppercase tracking-[1.5px] text-muted tabular-nums">
                      {list.length} role{list.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-4">
                    {list.map((role, i) => (
                      <JobCard key={role.job_code} role={role} index={i} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
