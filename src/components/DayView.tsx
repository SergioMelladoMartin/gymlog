import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getCategories,
  getExercises,
  getSetsForDate,
  getTrainingDaysInRange,
  getWorkoutComment,
  todayISO,
  type ExerciseExtra,
  type TrainingSetEx,
} from '../lib/queries';
import type { Category } from '../lib/types';
import WorkoutLogger from './WorkoutLogger';
import { useDatabase } from '../hooks/useDatabase';
import { useT } from '../hooks/useT';
import { getLocale } from '../lib/i18n';
import { DaySkeleton } from './ui/Skeleton';

const LS_WEEKLY_GOAL = 'gymlog-weekly-goal';

function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - dow);
  return isoOf(d);
}
function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

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
  const [weekDaysTrained, setWeekDaysTrained] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(4);

  useEffect(() => {
    if (!ready) return;
    setCategories(getCategories());
    setExercises(getExercises());
    setSets(getSetsForDate(nowDate));
    setComment(getWorkoutComment(nowDate));
    try {
      const today = todayISO();
      const monday = mondayOf(today);
      const sunday = isoOf(new Date(new Date(monday + 'T00:00:00').getTime() + 6 * 86_400_000));
      setWeekDaysTrained(getTrainingDaysInRange(monday, sunday).length);
    } catch { setWeekDaysTrained(0); }
    try {
      const stored = Number(localStorage.getItem(LS_WEEKLY_GOAL));
      setWeeklyGoal(stored > 0 ? stored : 4);
    } catch { setWeeklyGoal(4); }
  }, [ready, nowDate, sets.length]);

  const { totalVol, uniqueEx, hasPr } = useMemo(() => {
    const vol = sets.reduce((acc, s: any) => acc + s.weight_kg * s.reps, 0);
    const ex = new Set(sets.map((s) => s.exercise_id)).size;
    const pr = sets.some((s: any) => s.pr_weight || s.pr_reps);
    return { totalVol: vol, uniqueEx: ex, hasPr: pr };
  }, [sets]);

  if (!ready) return <DaySkeleton />;

  return (
    <>
      <DayHero
        date={nowDate}
        setCount={sets.length}
        exerciseCount={uniqueEx}
        volume={totalVol}
        hasPr={hasPr}
        weekDaysTrained={weekDaysTrained}
        weeklyGoal={weeklyGoal}
      />
      <WorkoutLogger
        key={nowDate}
        date={nowDate}
        exercises={exercises}
        categories={categories}
        initialSets={sets as any}
        initialComment={comment}
        onSetsChange={(fresh) => setSets(fresh as any)}
      />
      <AddExerciseFab />
    </>
  );
}

/** FAB — mobile only, opens the exercise picker already owned by
 *  WorkoutLogger via a window event (avoids prop-drilling picker state up
 *  through DayView). Portalled to <body>: the header's glass-bar creates a
 *  containing block for `position: fixed`, which would otherwise trap a
 *  fixed FAB declared under it. */
function AddExerciseFab() {
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  if (!mounted || isDesktop) return null;
  return createPortal(
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('gymlog:open-exercise-picker'))}
      aria-label={t('day.addExercise')}
      className="btn-accent accent-glow fixed z-40 grid h-14 w-14 place-items-center rounded-full active:scale-95"
      style={{ right: '1rem', bottom: 'calc(env(safe-area-inset-bottom) + 9.5rem)' }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
    </button>,
    document.body,
  );
}

// ─── "Hoy" hero: big day number + weekly-goal ring + stat tiles ─────────
function DayHero({ date, setCount, exerciseCount, volume, hasPr, weekDaysTrained, weeklyGoal }: {
  date: string; setCount: number; exerciseCount: number; volume: number; hasPr: boolean;
  weekDaysTrained: number; weeklyGoal: number;
}) {
  const { t, lang } = useT();
  const locale = getLocale(lang);
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

  const weekday = d.toLocaleDateString(locale, { weekday: 'long' });
  const dayNum = d.getDate();
  const month = d.toLocaleDateString(locale, { month: 'long' });
  const year = d.getFullYear();
  const isThisYear = year === new Date().getFullYear();

  const prevHref = `/day?d=${iso(prev)}`;
  const nextHref = `/day?d=${iso(next)}`;

  const goal = Math.max(1, weeklyGoal);
  const pct = Math.max(0, Math.min(1, weekDaysTrained / goal));
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const reachedGoal = weekDaysTrained >= goal;

  return (
    <section className="card relative mb-5 overflow-hidden">
      {isToday && <div className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}

      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <a href={prevHref}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-elevated/60 text-muted transition hover:bg-elevated hover:text-fg"
          aria-label={t('day.prevDay')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </a>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="section-title capitalize">{weekday}</span>
            {isToday && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">{t('nav.today')}</span>}
            {hasPr && (
              <span className="grid h-4 w-4 place-items-center rounded-full bg-accent text-ink" title={t('day.pr')}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 2h9l1.5 3h3.5l-2.5 5a6 6 0 0 1-4.4 3.85L14 18h2v2H8v-2h2l-.6-4.15A6 6 0 0 1 5 10L2.5 5H6zm0 2-.47.94L8.4 8.67A4 4 0 0 0 12 11a4 4 0 0 0 3.6-2.33L17.47 4.94 17 4z"/></svg>
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="font-display text-[48px] font-bold leading-none tracking-tight tabular-nums">{dayNum}</span>
            <span className="text-lg font-medium capitalize text-muted">{month}{!isThisYear ? ` ${year}` : ''}</span>
          </div>
        </div>

        <div className="relative shrink-0" title={t('day.weekProgress', { done: weekDaysTrained, goal })}>
          <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
            <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-border)" strokeWidth="5" />
            <circle
              cx="32" cy="32" r={r} fill="none"
              stroke={reachedGoal ? 'var(--color-accent)' : 'var(--color-accent)'}
              strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={circ - dash}
              className="resttimer-ring"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-sm font-bold tabular-nums">{weekDaysTrained}/{goal}</span>
          </div>
        </div>

        <a href={nextHref}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-elevated/60 text-muted transition hover:bg-elevated hover:text-fg"
          aria-label={t('day.nextDay')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </a>
      </div>

      {setCount > 0 ? (
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <div className="stat-tile flex-1 text-center">
            <div className="font-display text-xl font-semibold tabular-nums tracking-tight">{exerciseCount}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted">{t('day.statExercises')}</div>
          </div>
          <div className="stat-tile flex-1 text-center">
            <div className="font-display text-xl font-semibold tabular-nums tracking-tight">{setCount}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted">{t('day.statSets')}</div>
          </div>
          <div className="stat-tile flex-1 text-center">
            <div className="font-display text-xl font-semibold tabular-nums tracking-tight">
              {Math.round(volume).toLocaleString(locale)}<span className="ml-0.5 text-xs font-medium text-muted">kg</span>
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted">{t('day.statVolume')}</div>
          </div>
        </div>
      ) : (
        <div className="border-t border-border px-4 py-3 text-center text-xs text-muted">
          {isToday ? t('day.startBelow') : t('day.noWorkout')}
        </div>
      )}

      {!isToday && (
        <a href="/" className="block border-t border-border bg-elevated/40 px-4 py-2 text-center text-[11px] font-medium text-accent transition hover:bg-elevated">
          {t('day.backToToday')}
        </a>
      )}
    </section>
  );
}

