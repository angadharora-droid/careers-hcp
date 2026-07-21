export function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded-sm bg-beige-deep/70 ${className}`} aria-hidden="true" />;
}

export function JobCardSkeleton() {
  return (
    <div className="bg-card border border-line rounded-sm p-5 sm:px-7 sm:py-6 md:flex md:items-center md:gap-8">
      <div className="flex-1 min-w-0">
        <SkeletonBlock className="h-6 w-64 max-w-full" />
        <SkeletonBlock className="h-3 w-44 mt-3" />
        <SkeletonBlock className="h-3 w-full md:w-2/3 mt-4" />
      </div>
      <div className="mt-4 pt-4 border-t border-line md:mt-0 md:pt-0 md:border-t-0 md:shrink-0 flex items-center justify-between md:flex-col md:items-end gap-3">
        <SkeletonBlock className="h-4 w-36" />
        <SkeletonBlock className="h-4 w-28" />
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="bg-card border border-line rounded-sm">
      <div className="p-5 sm:p-7">
        <SkeletonBlock className="h-3 w-36" />
        <SkeletonBlock className="h-8 w-2/3 mt-3" />
        <SkeletonBlock className="h-3 w-1/2 mt-3" />
      </div>
      {Array.from({ length: 2 }).map((_, s) => (
        <div key={s} className="p-5 sm:p-7 border-t border-line">
          <SkeletonBlock className="h-5 w-44" />
          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <SkeletonBlock className="h-2.5 w-24" />
                <SkeletonBlock className="h-11 w-full mt-2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div>
      <SkeletonBlock className="h-4 w-40" />
      <SkeletonBlock className="h-9 w-2/3 mt-3" />
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:items-start mt-6">
        <div className="bg-card border border-line rounded-sm p-5 sm:p-7">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-3 w-full mt-5" />
          <SkeletonBlock className="h-3 w-full mt-2" />
          <SkeletonBlock className="h-3 w-4/5 mt-2" />
          <SkeletonBlock className="h-3 w-full mt-6" />
          <SkeletonBlock className="h-3 w-3/4 mt-2" />
          <SkeletonBlock className="h-3 w-5/6 mt-2" />
        </div>
        <div className="bg-card border border-line rounded-sm p-5 mt-5 lg:mt-0">
          <SkeletonBlock className="h-5 w-28" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="mt-4">
              <SkeletonBlock className="h-2.5 w-16" />
              <SkeletonBlock className="h-4 w-32 mt-2" />
            </div>
          ))}
          <SkeletonBlock className="h-11 w-full mt-6" />
        </div>
      </div>
    </div>
  );
}
