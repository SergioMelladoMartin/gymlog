/**
 * Skeleton.tsx — shimmering placeholder blocks used while a view's data is
 * still loading. Each view gets a loading state shaped like its real
 * layout (hero + stat tiles, grid, list rows, chart…) instead of a bare
 * spinner — the spinner is reserved for in-flight actions (see Toast /
 * button `disabled` states elsewhere).
 *
 * The shimmer animation is CSS-only (`.skel` in global.css) and disabled
 * under `prefers-reduced-motion` (handled centrally there too).
 */

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`skel rounded-lg ${className}`} />;
}

export function SkeletonCircle({ className = '' }: { className?: string }) {
  return <div className={`skel rounded-full ${className}`} />;
}

/** Hero + 3 stat tiles + one workout card — shape of DayView. */
export function DaySkeleton() {
  return (
    <div>
      <div className="card mb-4 flex items-center justify-between gap-4 p-5">
        <div className="flex flex-col gap-2">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-12 w-24" />
          <SkeletonBlock className="h-3 w-28" />
        </div>
        <SkeletonCircle className="h-16 w-16 shrink-0" />
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <SkeletonBlock className="stat-tile h-16" />
        <SkeletonBlock className="stat-tile h-16" />
        <SkeletonBlock className="stat-tile h-16" />
      </div>
      <div className="card flex flex-col gap-3 p-4">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-10 w-full" />
        <SkeletonBlock className="h-10 w-full" />
      </div>
    </div>
  );
}

/** Month grid — shape of CalendarView. */
export function CalendarSkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <SkeletonBlock className="h-6 w-32" />
        <SkeletonBlock className="h-8 w-20" />
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }).map((_, i) => (
          <SkeletonBlock key={i} className="aspect-square w-full" />
        ))}
      </div>
    </div>
  );
}

/** List of day cards — shape of DiaryView. */
export function DiarySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="card flex flex-col gap-2 p-4">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Category grid — shape of ExercisesView's group index. */
export function ExercisesSkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-8 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Stat tiles + chart — shape of StatsView. */
export function StatsSkeleton() {
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="stat-tile h-16" />
        ))}
      </div>
      <div className="card p-4">
        <SkeletonBlock className="mb-3 h-4 w-24" />
        <SkeletonBlock className="h-56 w-full" />
      </div>
    </div>
  );
}

/** Avatar + rows — shape of ProfileView. */
export function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <SkeletonCircle className="h-20 w-20" />
      <SkeletonBlock className="h-5 w-40" />
      <SkeletonBlock className="h-3 w-56" />
      <div className="mt-4 flex w-full max-w-sm flex-col gap-2">
        <SkeletonBlock className="h-12 w-full" />
        <SkeletonBlock className="h-12 w-full" />
        <SkeletonBlock className="h-12 w-full" />
      </div>
    </div>
  );
}

/** Chart + a couple of stat rows — shape of ExerciseDetailView. */
export function ExerciseDetailSkeleton() {
  return (
    <div>
      <SkeletonBlock className="mb-4 h-8 w-48" />
      <div className="card p-4">
        <SkeletonBlock className="h-56 w-full" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <SkeletonBlock className="stat-tile h-16" />
        <SkeletonBlock className="stat-tile h-16" />
        <SkeletonBlock className="stat-tile h-16" />
      </div>
    </div>
  );
}
