export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-navy-700/80 pb-6">
        <div className="space-y-2">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-navy-800" />
          <div className="h-4 w-56 animate-pulse rounded bg-navy-800/70" />
        </div>
        <div className="h-11 w-48 animate-pulse rounded-xl bg-navy-800" />
      </div>

      {/* Counter Skeletons */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-navy-700/60 bg-navy-900"
          />
        ))}
      </div>

      {/* Filter Bar Skeleton */}
      <div className="h-20 animate-pulse rounded-2xl border border-navy-700/60 bg-navy-900" />

      {/* Table / Cards Skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-navy-700/60 bg-navy-900"
          />
        ))}
      </div>
    </div>
  );
}
