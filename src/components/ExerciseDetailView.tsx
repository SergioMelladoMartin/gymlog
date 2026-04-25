import { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import {
  getCategories,
  getExerciseById,
  getExerciseSessionStats,
  getExerciseSetsHistory,
  type ExerciseExtra,
  type ExerciseSessionStat,
  type TrainingSetEx,
} from '../lib/queries';
import type { Category } from '../lib/types';
import ExerciseChart from './ExerciseChart';
import ExerciseHeaderEditor from './ExerciseHeaderEditor';

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function ExerciseDetailView() {
  const ready = useDatabase();
  const id = typeof window !== 'undefined'
    ? Number(new URL(window.location.href).searchParams.get('id') ?? 0)
    : 0;
  const [exercise, setExercise] = useState<ExerciseExtra | null>(null);
  const [sessions, setSessions] = useState<ExerciseSessionStat[]>([]);
  const [history, setHistory] = useState<TrainingSetEx[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const ex = getExerciseById(id);
    if (!ex) { setNotFound(true); return; }
    setExercise(ex);
    setSessions(getExerciseSessionStats(id));
    setHistory(getExerciseSetsHistory(id, 200));
    setCategories(getCategories());
  }, [ready, id]);

  if (!ready) return <div className="flex min-h-[50vh] items-center justify-center text-muted"><div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" /></div>;
  if (notFound) { if (typeof window !== 'undefined') window.location.replace('/exercises'); return null; }
  if (!exercise) return null;

  const totalSets = history.length;
  const totalSessions = sessions.length;
  const best1RM = sessions.reduce((a, s) => Math.max(a, s.est_1rm ?? 0), 0);
  const heaviest = sessions.reduce((a, s) => Math.max(a, s.top_weight ?? 0), 0);

  let bestSet = history[0];
  for (const s of history) {
    if (!bestSet || s.weight_kg > bestSet.weight_kg || (s.weight_kg === bestSet.weight_kg && s.reps > bestSet.reps)) {
      bestSet = s;
    }
  }

  const historyByDate = new Map<string, TrainingSetEx[]>();
  for (const s of history) {
    if (!historyByDate.has(s.date)) historyByDate.set(s.date, []);
    historyByDate.get(s.date)!.push(s);
  }

  return (
    <>
      <div className="mb-5">
        <a href="/exercises" className="mb-2 inline-flex items-center gap-1 text-sm text-muted transition hover:text-fg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Ejercicios
        </a>
        <ExerciseHeaderEditor
          exerciseId={exercise.id}
          initialName={exercise.name}
          initialCategoryId={exercise.category_id}
          categoryName={exercise.category_name}
          categoryColor={exercise.category_color}
          categories={categories}
        />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Sesiones" value={String(totalSessions)} />
        <Tile label="Sets" value={String(totalSets)} />
        <Tile label="Top peso" value={String(heaviest)} unit="kg" sub={bestSet ? `${bestSet.weight_kg} × ${bestSet.reps}` : undefined} />
        <Tile label="1RM est." value={String(Math.round(best1RM * 10) / 10)} unit="kg" accent />
      </div>

      <div className="card mb-5 p-4">
        <div className="section-title mb-3">Progresión</div>
        <ExerciseChart data={sessions} />
      </div>

      <div className="card p-4">
        <div className="section-title mb-3">Historial</div>
        <div className="flex flex-col divide-y divide-border">
          {[...historyByDate.entries()].map(([date, sets]) => {
            // Highlight the heaviest set of the day so the user spots it
            // at a glance. Tie-break by reps so 80×8 wins over 80×6.
            let topIdx = 0;
            for (let i = 1; i < sets.length; i++) {
              const a = sets[i], b = sets[topIdx];
              if (a.weight_kg > b.weight_kg || (a.weight_kg === b.weight_kg && a.reps > b.reps)) topIdx = i;
            }
            return (
              <a key={date} href={`/day?d=${date}`} className="-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-2.5 text-sm transition hover:bg-elevated">
                <span className="shrink-0 capitalize text-muted">{formatDate(date)}</span>
                <span className="text-right tabular-nums">
                  {sets.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 && <span className="text-muted"> · </span>}
                      <span className={i === topIdx ? 'font-semibold text-accent' : ''}>
                        {s.weight_kg}×{s.reps}
                      </span>
                    </span>
                  ))}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Tile({ label, value, unit, sub, accent }: { label: string; value: string; unit?: string; sub?: string; accent?: boolean }) {
  return (
    <div className="stat-tile">
      <div className="section-title">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums tracking-tight ${accent ? 'text-accent' : ''}`}>
        {value}{unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
      </div>
      {sub && <div className="text-xs tabular-nums text-muted">{sub}</div>}
    </div>
  );
}
