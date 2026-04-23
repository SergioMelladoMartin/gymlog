import { useEffect, useMemo, useState } from 'react';
import {
  getCategories,
  getExercises,
  getSetsForDate,
  getWorkoutComment,
  todayISO,
  type ExerciseExtra,
  type TrainingSetEx,
} from '../lib/queries';
import type { Category } from '../lib/types';
import WorkoutLogger from './WorkoutLogger';
import { useDatabase } from '../hooks/useDatabase';

export default function DayView() {
  const ready = useDatabase();
  const urlDate = typeof window !== 'undefined'
    ? new URL(window.location.href).searchParams.get('d')
    : null;
  const [nowDate, setNowDate] = useState(urlDate ?? todayISO());
  const [categories, setCategories] = useState<Category[]>([]);
  const [exercises, setExercises] = useState<ExerciseExtra[]>([]);
  const [sets, setSets] = useState<(TrainingSetEx & any)[]>([]);
  const [comment, setComment] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setCategories(getCategories());
    setExercises(getExercises());
    setSets(getSetsForDate(nowDate));
    setComment(getWorkoutComment(nowDate));
  }, [ready, nowDate]);

  const { totalVol, uniqueEx, hasPr } = useMemo(() => {
    const vol = sets.reduce((acc, s: any) => acc + s.weight_kg * s.reps, 0);
    const ex = new Set(sets.map((s) => s.exercise_id)).size;
    const pr = sets.some((s: any) => s.pr_weight || s.pr_1rm || s.pr_reps);
    return { totalVol: vol, uniqueEx: ex, hasPr: pr };
  }, [sets]);

  if (!ready) return <LoadingSpinner />;

  return (
    <>
      <DayHeader date={nowDate} setCount={sets.length} exerciseCount={uniqueEx} volume={totalVol} hasPr={hasPr} />
      <WorkoutLogger
        key={nowDate}
        date={nowDate}
        exercises={exercises}
        categories={categories}
        initialSets={sets as any}
        initialComment={comment}
      />
    </>
  );
}

// ─── Day header (slim, uses prev/next links) ────────────────────────────
function DayHeader({ date, setCount, exerciseCount, volume, hasPr }: {
  date: string; setCount: number; exerciseCount: number; volume: number; hasPr: boolean;
}) {
  const today = todayISO();
  const isToday = date === today;

  const d = new Date(date + 'T00:00:00');
  const prev = new Date(d); prev.setDate(prev.getDate() - 1);
  const next = new Date(d); next.setDate(next.getDate() + 1);
  const iso = (x: Date) => {
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const weekday = d.toLocaleDateString('es-ES', { weekday: 'long' });
  const dayNum = d.getDate();
  const month = d.toLocaleDateString('es-ES', { month: 'long' });
  const year = d.getFullYear();
  const isThisYear = year === new Date().getFullYear();

  const prevHref = `/day?d=${iso(prev)}`;
  const nextHref = `/day?d=${iso(next)}`;

  return (
    <section className="relative mb-5 overflow-hidden rounded-2xl border border-border bg-card">
      {isToday && <div className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}

      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <a href={prevHref}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-elevated text-muted transition hover:text-fg"
          aria-label="Día anterior">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </a>

        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted capitalize">{weekday}</span>
            {isToday && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">Hoy</span>}
            {hasPr && (
              <span className="grid h-4 w-4 place-items-center rounded-full bg-accent text-ink" title="Récord personal">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 2h9l1.5 3h3.5l-2.5 5a6 6 0 0 1-4.4 3.85L14 18h2v2H8v-2h2l-.6-4.15A6 6 0 0 1 5 10L2.5 5H6zm0 2-.47.94L8.4 8.67A4 4 0 0 0 12 11a4 4 0 0 0 3.6-2.33L17.47 4.94 17 4z"/></svg>
              </span>
            )}
          </div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight tabular-nums capitalize">
            {dayNum} {month}{!isThisYear ? ` ${year}` : ''}
          </h1>
        </div>

        <a href={nextHref}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-elevated text-muted transition hover:text-fg"
          aria-label="Día siguiente">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </a>
      </div>

      {setCount > 0 ? (
        <div className="grid grid-cols-3 border-t border-border">
          <div className="border-r border-border px-3 py-3 text-center">
            <div className="text-xl font-semibold tabular-nums tracking-tight">{exerciseCount}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted">ejercicios</div>
          </div>
          <div className="border-r border-border px-3 py-3 text-center">
            <div className="text-xl font-semibold tabular-nums tracking-tight">{setCount}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted">sets</div>
          </div>
          <div className="px-3 py-3 text-center">
            <div className="text-xl font-semibold tabular-nums tracking-tight">
              {Math.round(volume).toLocaleString('es-ES')}<span className="ml-0.5 text-xs font-medium text-muted">kg</span>
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted">volumen</div>
          </div>
        </div>
      ) : (
        <div className="border-t border-border px-4 py-3 text-center text-xs text-muted">
          {isToday ? 'Empieza tu entreno abajo' : 'Sin entreno este día'}
        </div>
      )}

      {!isToday && (
        <a href="/" className="block border-t border-border bg-elevated/40 px-4 py-2 text-center text-[11px] font-medium text-accent transition hover:bg-elevated">
          ← volver a hoy
        </a>
      )}
    </section>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      <span className="text-sm">Cargando…</span>
    </div>
  );
}
