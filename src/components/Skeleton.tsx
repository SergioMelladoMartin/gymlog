import clsx from 'clsx';

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'skeleton-bone rounded-lg bg-elevated/80',
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function DaySkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
          <Bone className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col items-center gap-2">
            <Bone className="h-3 w-20" />
            <Bone className="h-8 w-40" />
          </div>
          <Bone className="h-9 w-9 shrink-0 rounded-lg" />
        </div>
        <div className="grid grid-cols-3 border-t border-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-r border-border px-3 py-3 last:border-r-0">
              <Bone className="mx-auto h-6 w-10" />
              <Bone className="mx-auto mt-2 h-2 w-14" />
            </div>
          ))}
        </div>
      </div>
      <Bone className="h-12 w-full rounded-2xl" />
      {[0, 1].map((i) => (
        <div key={i} className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bone className="h-2.5 w-2.5 rounded-full" />
            <Bone className="h-4 w-36" />
          </div>
          <div className="flex flex-col gap-2">
            <Bone className="h-10 w-full" />
            <Bone className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="flex items-center justify-between">
        <Bone className="h-9 w-9 rounded-lg" />
        <Bone className="h-6 w-32" />
        <Bone className="h-9 w-9 rounded-lg" />
      </div>
      <Bone className="mx-auto h-9 w-40 rounded-full" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="stat-tile">
            <Bone className="h-3 w-12" />
            <Bone className="mt-2 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }).map((_, i) => (
          <Bone key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function DiarySkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div>
        <Bone className="h-3 w-20" />
        <Bone className="mt-2 h-8 w-28" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card flex overflow-hidden">
          <div className="flex w-20 flex-col items-center gap-2 border-r border-border bg-elevated px-3 py-4">
            <Bone className="h-2 w-8" />
            <Bone className="h-8 w-8" />
            <Bone className="h-2 w-10" />
          </div>
          <div className="flex-1 p-4">
            <Bone className="h-3 w-full" />
            <Bone className="mt-3 h-3 w-4/5" />
            <Bone className="mt-2 h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div>
        <Bone className="h-3 w-24" />
        <Bone className="mt-2 h-8 w-36" />
      </div>
      <div className="card p-4">
        <Bone className="h-3 w-32" />
        <Bone className="mt-4 h-52 w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat-tile">
            <Bone className="h-3 w-10" />
            <Bone className="mt-2 h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="card p-4">
        <Bone className="mb-3 h-3 w-40" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Bone key={i} className="mb-2 h-6 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ExercisesSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Bone className="h-3 w-16" />
      <Bone className="h-8 w-40" />
      <Bone className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bone key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <Bone className="h-8 w-28" />
      <div className="card flex items-center gap-4 p-5">
        <Bone className="h-20 w-20 shrink-0 rounded-full" />
        <div className="flex-1">
          <Bone className="h-5 w-36" />
          <Bone className="mt-2 h-3 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat-tile">
            <Bone className="h-3 w-12" />
            <Bone className="mt-2 h-7 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="card p-4" aria-busy="true">
      <Bone className="mb-4 h-6 w-48" />
      <Bone className="h-48 w-full rounded-lg" />
    </div>
  );
}

export function GenericSkeleton() {
  return (
    <div className="flex min-h-[50vh] flex-col gap-4 py-4" aria-busy="true">
      <Bone className="h-8 w-48" />
      <Bone className="h-32 w-full rounded-xl" />
      <Bone className="h-32 w-full rounded-xl" />
    </div>
  );
}
