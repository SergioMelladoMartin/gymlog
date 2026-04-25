import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category } from '../lib/types';
import type { ExerciseExtra as Exercise, TrainingSetEx } from '../lib/queries';
import {
  createExercise as qCreateExercise,
  createSet as qCreateSet,
  deleteSet as qDeleteSet,
  duplicateSet as qDuplicateSet,
  getSetsForDate as qGetSets,
  setWorkoutComment as qSetComment,
  updateSet as qUpdateSet,
} from '../lib/queries';
import { useT } from '../hooks/useT';

function vibrate(pattern: number | number[]) {
  try { if ('vibrate' in navigator) navigator.vibrate(pattern); } catch {}
}

// Runtime set shape used by the logger — extended query type with PR flags
// and the legacy `is_personal_record` for backwards compat with the UI.
type TrainingSet = TrainingSetEx & {
  pr_weight?: boolean | number;
  pr_1rm?: boolean | number;
  pr_reps?: boolean | number;
  is_personal_record?: number;
};

interface Props {
  date: string;
  exercises: Exercise[];
  categories: Category[];
  initialSets: TrainingSet[];
  initialComment: string | null;
}

interface DraftSet {
  weight: string;
  reps: string;
}

export default function WorkoutLogger({ date, exercises: initialExercises, categories, initialSets, initialComment }: Props) {
  const { t } = useT();
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);
  const [sets, setSets] = useState<TrainingSet[]>(initialSets);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [comment, setComment] = useState<string>(initialComment ?? '');
  const [commentDirty, setCommentDirty] = useState(false);
  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  // Exercises chosen via the picker but without any sets yet. They still
  // deserve a card so the user can log their first set.
  const [pendingExerciseIds, setPendingExerciseIds] = useState<number[]>([]);
  // Which card currently has its "add set" form expanded. Only one at a time
  // so the sets you've already logged stay easy to read — the form was
  // cluttering the view when it was always-on.
  const [openAdderId, setOpenAdderId] = useState<number | null>(null);

  // Sync incoming props when the parent finishes loading data from the
  // in-browser db. `useState(initialSets)` only reads props on first render,
  // so without this the logger stayed empty on the very first paint of the
  // day view (DayView's useEffect populates props one tick after mount).
  useEffect(() => { setSets(initialSets); }, [initialSets]);
  useEffect(() => { setExercises(initialExercises); }, [initialExercises]);
  useEffect(() => {
    setComment(initialComment ?? '');
    setCommentDirty(false);
  }, [initialComment]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const isCardioExercise = (exerciseId: number) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    return !!ex && categoryById.get(ex.category_id)?.name === 'Cardio';
  };

  const grouped = useMemo(() => {
    const order: number[] = [];
    const map = new Map<number, TrainingSet[]>();
    for (const s of sets) {
      if (!map.has(s.exercise_id)) {
        order.push(s.exercise_id);
        map.set(s.exercise_id, []);
      }
      map.get(s.exercise_id)!.push(s);
    }
    return order.map((id) => ({ exerciseId: id, sets: map.get(id)! }));
  }, [sets]);

  // All mutations now go through the in-browser SQLite db. Reads are
  // synchronous and instant, so there's no optimistic/rollback dance —
  // we just refetch from the local DB after each write.

  useEffect(() => {
    if (!commentDirty) return;
    const t = setTimeout(() => {
      try { qSetComment(date, comment); } catch (e) { console.error(e); }
      setCommentDirty(false);
    }, 600);
    return () => clearTimeout(t);
  }, [comment, commentDirty, date]);

  function refreshSets() {
    setSets(qGetSets(date) as TrainingSet[]);
  }

  function addSet(exerciseId: number, weight: number, reps: number) {
    const result = qCreateSet({ exercise_id: exerciseId, date, weight_kg: weight, reps });
    refreshSets();
    setPendingExerciseIds((prev) => prev.filter((id) => id !== exerciseId));
    // Light tap on save, stronger triple-buzz if we just set a PR.
    if (result?.pr_weight || result?.pr_1rm || result?.pr_reps) vibrate([20, 40, 20, 40, 40]);
    else vibrate(10);
  }

  function addCardioSet(exerciseId: number, durationSec: number, distanceM: number) {
    qCreateSet({
      exercise_id: exerciseId,
      date,
      weight_kg: 0,
      reps: 0,
      duration_seconds: durationSec,
      distance_m: distanceM,
    });
    refreshSets();
    setPendingExerciseIds((prev) => prev.filter((id) => id !== exerciseId));
    vibrate(10);
  }

  function duplicateSet(setId: number) {
    qDuplicateSet(setId);
    refreshSets();
    setEditingSetId(null);
    vibrate(10);
  }

  function deleteSet(id: number) {
    qDeleteSet(id);
    refreshSets();
  }

  function updateSet(
    id: number,
    patch: Partial<Pick<TrainingSet, 'weight_kg' | 'reps' | 'duration_seconds' | 'distance_m'>>,
  ) {
    qUpdateSet(id, patch);
    refreshSets();
  }

  function selectExercise(id: number) {
    setPickerOpen(false);
    // If it's not yet in today's sets, queue a blank card for it.
    if (!sets.some((s) => s.exercise_id === id)) {
      setPendingExerciseIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }
    // Auto-expand the adder for the picked exercise so the user lands
    // directly on the entry form.
    setOpenAdderId(id);
    // Bring it into view + focus the entry form after paint.
    setTimeout(() => {
      const node = document.getElementById(`ex-${id}`);
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = node?.querySelector<HTMLInputElement>('input[data-quickadd-focus]');
      input?.focus();
    }, 80);
  }

  async function createExercise(name: string, categoryId: number): Promise<Exercise | null> {
    try {
      const id = qCreateExercise(name, categoryId);
      const cat = categories.find((c) => c.id === categoryId);
      const ex: Exercise = {
        id,
        name,
        category_id: categoryId,
        category_name: cat?.name ?? '',
        category_color: cat?.color ?? null,
        notes: null,
        is_favorite: false,
        last_used: null,
      };
      setExercises((prev) => [...prev, ex]);
      return ex;
    } catch (e: any) {
      alert(e?.message ?? 'Error al crear ejercicio');
      return null;
    }
  }

  // Render order: exercises with sets (in the order they were first logged),
  // followed by any that were picked but haven't got a set yet.
  const allCards = useMemo(() => {
    const withSetsIds = new Set(grouped.map((g) => g.exerciseId));
    const pending = pendingExerciseIds
      .filter((id) => !withSetsIds.has(id))
      .map((id) => ({ exerciseId: id, sets: [] as TrainingSet[] }));
    return [...grouped, ...pending];
  }, [grouped, pendingExerciseIds]);

  // PR summary for today
  const prTotals = useMemo(() => {
    let w = 0, rm = 0, r = 0;
    for (const s of sets) {
      if (s.pr_weight) w++;
      if (s.pr_1rm) rm++;
      if (s.pr_reps) r++;
    }
    return { w, rm, r, any: w + rm + r };
  }, [sets]);

  return (
    <div className="flex flex-col gap-5">
      {prTotals.any > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-ink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 2h9l1.5 3h3.5l-2.5 5a6 6 0 0 1-4.4 3.85L14 18h2v2H8v-2h2l-.6-4.15A6 6 0 0 1 5 10L2.5 5H6zm0 2-.47.94L8.4 8.67A4 4 0 0 0 12 11a4 4 0 0 0 3.6-2.33L17.47 4.94 17 4z"/></svg>
            </span>
            <div>
              <div className="text-sm font-semibold text-fg">{t('workout.newPr')}</div>
              <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px]">
                {prTotals.w > 0 && <PrTag label={`${prTotals.w}× ${t('field.weight').replace(' · kg', '').toLowerCase()}`} />}
                {prTotals.rm > 0 && <PrTag label={`${prTotals.rm}× 1RM`} />}
                {prTotals.r > 0 && <PrTag label={`${prTotals.r}× ${t('field.reps').toLowerCase()}`} />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add-exercise CTA — always visible at the top so starting a new
          exercise is never confused with editing the one you're on. */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3.5 text-sm font-semibold text-fg transition hover:border-strong hover:bg-elevated"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
        {t('workout.addExercise')}
      </button>

      {allCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
          <div className="text-base font-semibold tracking-tight">{t('workout.noExercisesTitle')}</div>
          <div className="text-sm text-muted">{t('workout.noExercisesBody')}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {allCards.map(({ exerciseId, sets: exSets }) => {
            const ex = exercises.find((e) => e.id === exerciseId);
            const cardio = isCardioExercise(exerciseId);
            const totalVol = exSets.reduce((acc, s) => acc + s.weight_kg * s.reps, 0);
            const totalDuration = exSets.reduce((acc, s) => acc + s.duration_seconds, 0);
            const totalDistance = exSets.reduce((acc, s) => acc + s.distance_m, 0);
            const catColor = ex?.category_color ?? '#888';
            const lastExSets = exSets;
            return (
              <article
                key={exerciseId}
                id={`ex-${exerciseId}`}
                className="card relative overflow-hidden"
                style={{ boxShadow: `inset 3px 0 0 ${catColor}` }}
              >
                <header className="flex items-center justify-between gap-2 px-4 py-3">
                  <a href={`/exercise?id=${exerciseId}`} className="min-w-0 flex-1 truncate font-semibold tracking-tight hover:underline">
                    {ex?.name ?? `#${exerciseId}`}
                  </a>
                  <span className="hidden shrink-0 text-xs tabular-nums text-muted sm:inline">
                    {exSets.length === 0
                      ? t('workout.noSetsYet')
                      : `${exSets.length} ${exSets.length === 1 ? t('workout.serie') : t('workout.series')}${cardio
                          ? `${totalDuration ? ` · ${formatDuration(totalDuration)}` : ''}${totalDistance > 0 ? ` · ${formatDistance(totalDistance)}` : ''}`
                          : ` · ${Math.round(totalVol).toLocaleString('es-ES')} kg`}`}
                  </span>
                </header>

                {exSets.length > 0 && (
                  <>
                    <div className="flex items-center justify-between border-t border-border/60 bg-elevated/30 px-4 py-1.5 text-[11px] tabular-nums text-muted sm:hidden">
                      <span>{exSets.length} {exSets.length === 1 ? t('workout.serie') : t('workout.series')}</span>
                      <span>
                        {cardio
                          ? `${formatDuration(totalDuration)}${totalDistance > 0 ? ` · ${formatDistance(totalDistance)}` : ''}`
                          : `${Math.round(totalVol).toLocaleString('es-ES')} kg`}
                      </span>
                    </div>

                    <ol className="flex flex-col divide-y divide-border/60">
                      {exSets.map((s, i) => (
                        <SetRow
                          key={s.id}
                          set={s}
                          index={i}
                          cardio={cardio}
                          editing={editingSetId === s.id}
                          onStartEdit={() => setEditingSetId(s.id)}
                          onCancelEdit={() => setEditingSetId(null)}
                          onSave={async (patch) => {
                            await updateSet(s.id, patch);
                            setEditingSetId(null);
                          }}
                          onDelete={() => {
                            if (window.confirm(t('workout.confirmDeleteSet'))) deleteSet(s.id);
                          }}
                          onDuplicate={() => duplicateSet(s.id)}
                        />
                      ))}
                    </ol>
                  </>
                )}

                {openAdderId === exerciseId ? (
                  <div className="relative border-t border-border/60 bg-elevated/20 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenAdderId(null)}
                      aria-label={t('action.close')}
                      title={t('action.close')}
                      className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-muted transition hover:bg-card hover:text-fg"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                    {cardio ? (
                      <QuickAddCardio exerciseId={exerciseId} onAdd={addCardioSet} lastSets={lastExSets} />
                    ) : (
                      <QuickAdd exerciseId={exerciseId} onAdd={addSet} lastSets={lastExSets} />
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenAdderId(exerciseId)}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-border/80 bg-transparent px-4 py-2 text-[11px] font-medium text-muted transition hover:bg-elevated/40 hover:text-fg"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                    {t('workout.addSet')}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Notes */}
      <section className="card p-4">
        <div className="section-title mb-2">{t('workout.notes')}</div>
        <textarea
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setCommentDirty(true);
          }}
          placeholder={t('workout.notesPlaceholder')}
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-elevated px-3 py-2 text-sm outline-none transition focus:border-accent/60"
        />
      </section>

      {pickerOpen && (
        <ExercisePicker
          exercises={exercises}
          categories={categories}
          onSelect={selectExercise}
          onClose={() => setPickerOpen(false)}
          onCreate={createExercise}
        />
      )}
    </div>
  );
}

function QuickAdd({
  exerciseId,
  onAdd,
  lastSets,
}: {
  exerciseId: number;
  onAdd: (id: number, w: number, r: number) => void;
  lastSets: TrainingSet[];
}) {
  const { t: tLocal } = useT();
  const [draft, setDraft] = useState<DraftSet>({ weight: '', reps: '' });
  const [justAdded, setJustAdded] = useState(false);
  const weightRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  // Seed the form only when the exercise changes — NOT every time a new set
  // is added. Otherwise adding a set would repopulate the reps field from
  // the just-added set and lead to accidental double-submits.
  useEffect(() => {
    const last = lastSets.at(-1);
    setDraft({
      weight: last ? String(last.weight_kg) : '',
      reps: last ? String(last.reps) : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;           // ignore rapid re-submits
    const w = parseFloat(draft.weight.replace(',', '.'));
    const r = parseInt(draft.reps, 10);
    if (isNaN(w) || isNaN(r) || r <= 0) return;
    submittingRef.current = true;
    onAdd(exerciseId, w, r);
    // Keep BOTH weight and reps from the just-saved set — most users go for
    // the same load + reps combo for several sets in a row.
    setDraft({ weight: String(w), reps: String(r) });
    setJustAdded(true);
    setTimeout(() => { setJustAdded(false); submittingRef.current = false; }, 400);
    // NOTE: deliberately *not* calling weightRef.current?.focus(). Moving
    // focus from reps (numeric kb) to weight (decimal kb) made the mobile
    // keyboard collapse and re-open on every save. We keep focus where the
    // user already had it.
  }

  function bumpWeight(delta: number) {
    const current = parseFloat(draft.weight.replace(',', '.'));
    const base = isNaN(current) ? 0 : current;
    const next = Math.max(0, Math.round((base + delta) * 100) / 100);
    setDraft((d) => ({ ...d, weight: formatKg(next) }));
  }

  function bumpReps(delta: number) {
    const current = parseInt(draft.reps, 10);
    const base = isNaN(current) ? 0 : current;
    const next = Math.max(0, base + delta);
    setDraft((d) => ({ ...d, reps: next === 0 ? '' : String(next) }));
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <StepperField
        label={tLocal('field.weight')}
        value={draft.weight}
        onChange={(v) => setDraft((d) => ({ ...d, weight: v }))}
        onDecrement={() => bumpWeight(-2.5)}
        onIncrement={() => bumpWeight(+2.5)}
        decrementLabel="-2.5 kg"
        incrementLabel="+2.5 kg"
        inputRef={weightRef}
        focusMarker
        decimal
      />
      <StepperField
        label={tLocal('field.reps')}
        value={draft.reps}
        onChange={(v) => setDraft((d) => ({ ...d, reps: v }))}
        onDecrement={() => bumpReps(-1)}
        onIncrement={() => bumpReps(+1)}
        decrementLabel="-1"
        incrementLabel="+1"
      />
      <button
        type="submit"
        // tabIndex+mousedown preventDefault keeps the focused input from
        // blurring when this button is tapped, so the mobile keyboard
        // doesn't flicker close-then-open on every save.
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl bg-accent text-ink transition hover:brightness-110 active:scale-95 disabled:opacity-40"
        disabled={!draft.weight || !draft.reps}
        aria-label={justAdded ? 'Añadido' : 'Añadir set'}
      >
        {justAdded ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
        )}
      </button>
    </form>
  );
}

function StepperField({
  label,
  value,
  onChange,
  onDecrement,
  onIncrement,
  decrementLabel,
  incrementLabel,
  inputRef,
  focusMarker = false,
  decimal = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementLabel: string;
  incrementLabel: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  focusMarker?: boolean;
  decimal?: boolean;
}) {
  return (
    <label className="min-w-0 flex-1">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="flex h-[52px] items-stretch overflow-hidden rounded-xl border border-border bg-elevated transition focus-within:border-accent/60">
        <button
          type="button"
          onClick={onDecrement}
          // Stay non-focusable + cancel the synthetic focus shift so the
          // input keeps focus and the mobile keyboard doesn't blink.
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={decrementLabel}
          className="grid w-10 shrink-0 place-items-center border-r border-border text-muted transition hover:text-fg active:bg-border/40"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14" /></svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          inputMode={decimal ? 'decimal' : 'numeric'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...(focusMarker ? { 'data-quickadd-focus': '' } : {})}
          className="min-w-0 flex-1 bg-transparent px-1 text-center text-lg font-semibold tabular-nums outline-none"
        />
        <button
          type="button"
          onClick={onIncrement}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={incrementLabel}
          className="grid w-10 shrink-0 place-items-center border-l border-border text-muted transition hover:text-fg active:bg-border/40"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
        </button>
      </div>
    </label>
  );
}

function ExercisePicker({
  exercises,
  categories,
  onSelect,
  onClose,
  onCreate,
}: {
  exercises: Exercise[];
  categories: Category[];
  onSelect: (id: number) => void;
  onClose: () => void;
  onCreate: (name: string, categoryId: number) => Promise<Exercise | null>;
}) {
  const [query, setQuery] = useState('');
  const [stepCategory, setStepCategory] = useState<number | null>(null); // null = group index
  const [creatorOpen, setCreatorOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (creatorOpen) { setCreatorOpen(false); return; }
      if (stepCategory !== null) { setStepCategory(null); return; }
      if (query) { setQuery(''); return; }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, creatorOpen, stepCategory, query]);

  const q = query.trim().toLowerCase();
  const isSearching = q.length > 0;

  const countByCat = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of exercises) m.set(e.category_id, (m.get(e.category_id) ?? 0) + 1);
    return m;
  }, [exercises]);

  const lastUsedByCat = useMemo(() => {
    const m = new Map<number, string>();
    for (const e of exercises) {
      if (!e.last_used) continue;
      const cur = m.get(e.category_id);
      if (!cur || e.last_used > cur) m.set(e.category_id, e.last_used);
    }
    return m;
  }, [exercises]);

  // Exercises to render in the list view (search or category picked).
  // When browsing a specific muscle group, alphabetical order is more useful
  // than "recently used"; the latter still applies to global searches where
  // surfacing the last exercises you've logged saves taps.
  const visibleExercises = useMemo(() => {
    let list = exercises;
    if (stepCategory !== null) list = list.filter((e) => e.category_id === stepCategory);
    if (isSearching) list = list.filter((e) => e.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      if (stepCategory !== null) return a.name.localeCompare(b.name);
      if (a.last_used && b.last_used) return a.last_used < b.last_used ? 1 : -1;
      if (a.last_used) return -1;
      if (b.last_used) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [exercises, stepCategory, q, isSearching]);

  const activeCategory = stepCategory != null ? categories.find((c) => c.id === stepCategory) ?? null : null;
  const showGroupsIndex = !isSearching && stepCategory === null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-xl">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 pt-4 pb-2">
        {/* Top bar: back button (if inside group or searching) + search input + close */}
        <div className="flex items-center gap-2">
          {stepCategory !== null && (
            <button
              type="button"
              onClick={() => { setStepCategory(null); setQuery(''); }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted transition hover:text-fg"
              aria-label="Volver a grupos"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          )}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              autoFocus
              placeholder={activeCategory ? `Buscar en ${activeCategory.name}…` : 'Buscar ejercicio…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-elevated pl-9 pr-3 py-2.5 outline-none transition focus:border-accent/60"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-card hover:text-fg"
          >
            Cerrar
          </button>
        </div>

        {/* Step header when inside a group */}
        {activeCategory && !isSearching && (
          <div className="mt-3 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: activeCategory.color ?? '#888' }} />
            <h2 className="text-lg font-semibold tracking-tight">{activeCategory.name}</h2>
            <span className="text-xs text-muted">· {countByCat.get(activeCategory.id) ?? 0} ejercicios</span>
          </div>
        )}

        {creatorOpen && (
          <CreateExerciseForm
            initialName={query}
            initialCategoryId={stepCategory ?? categories[0]?.id ?? null}
            categories={categories}
            onCancel={() => setCreatorOpen(false)}
            onCreate={async (name, cat) => {
              const ex = await onCreate(name, cat);
              if (ex) {
                setCreatorOpen(false);
                onSelect(ex.id);
              }
            }}
          />
        )}

        {/* Body: groups index OR exercise list */}
        {showGroupsIndex ? (
          <div className="mt-3 flex-1 overflow-y-auto">
            <div className="mb-2 text-xs text-muted">Elige un grupo muscular</div>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((c) => {
                const n = countByCat.get(c.id) ?? 0;
                const last = lastUsedByCat.get(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setStepCategory(c.id)}
                    className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-left transition hover:border-strong hover:bg-elevated"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: c.color ?? '#888', boxShadow: `0 0 8px ${c.color}55` }} />
                        <span className="truncate font-semibold">{c.name}</span>
                      </span>
                      <span className="mt-0.5 text-[11px] text-muted">
                        {n} ejerc{last ? ` · ${relativeDate(last)}` : ''}
                      </span>
                    </div>
                    <svg className="shrink-0 text-muted transition group-hover:text-fg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <ul className="mt-3 flex-1 overflow-y-auto rounded-xl border border-border bg-card/60 min-h-0">
            {visibleExercises.map((e) => (
              <li key={e.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => onSelect(e.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-elevated"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.category_color ?? '#888' }} />
                    <span className="truncate">{e.name}</span>
                  </span>
                  {e.last_used && <span className="shrink-0 text-xs text-muted">{relativeDate(e.last_used)}</span>}
                </button>
              </li>
            ))}
            {visibleExercises.length === 0 && (
              <li className="flex flex-col items-center justify-center gap-3 py-10 text-center text-sm text-muted">
                <span>{isSearching ? `Sin resultados para "${query}"` : 'Este grupo aún no tiene ejercicios'}</span>
                <button
                  type="button"
                  onClick={() => setCreatorOpen(true)}
                  className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-ink transition hover:brightness-110"
                >
                  + Crear {isSearching && query.trim() ? `"${query.trim()}"` : 'nuevo ejercicio'}
                </button>
              </li>
            )}
          </ul>
        )}

        {!creatorOpen && !showGroupsIndex && (
          <div className="mt-2 flex shrink-0 items-center justify-between">
            <span className="text-[11px] text-muted">
              {visibleExercises.length} resultado{visibleExercises.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => setCreatorOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-fg transition hover:border-strong hover:bg-elevated"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
              Crear ejercicio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SetRow({
  set,
  index,
  cardio,
  editing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onDuplicate,
}: {
  set: TrainingSet;
  index: number;
  cardio: boolean;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: Partial<Pick<TrainingSet, 'weight_kg' | 'reps' | 'duration_seconds' | 'distance_m'>>) => void | Promise<void>;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  if (editing) {
    return (
      <li className="bg-elevated/40 px-4 py-2.5">
        {cardio ? (
          <EditCardioForm
            initialDuration={set.duration_seconds}
            initialDistance={set.distance_m}
            onCancel={onCancelEdit}
            onSave={(dur, dist) => onSave({ duration_seconds: dur, distance_m: dist })}
            onDuplicate={onDuplicate}
          />
        ) : (
          <EditWeightForm
            initialWeight={set.weight_kg}
            initialReps={set.reps}
            onCancel={onCancelEdit}
            onSave={(w, r) => onSave({ weight_kg: w, reps: r })}
            onDuplicate={onDuplicate}
          />
        )}
      </li>
    );
  }

  const isOptimistic = set.id < 0;
  return (
    <li
      className={`row-in group flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition hover:bg-elevated/40 ${isOptimistic ? 'opacity-80' : ''}`}
    >
      <button
        type="button"
        onClick={onStartEdit}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-elevated text-[11px] font-semibold text-muted tabular-nums">
          {index + 1}
        </span>
        {cardio ? (
          <span className="flex items-baseline tabular-nums">
            <span className="w-16 text-right text-lg font-semibold">{formatDuration(set.duration_seconds)}</span>
            {set.distance_m > 0 ? (
              <>
                <span className="mx-2 text-muted">·</span>
                <span className="text-right text-lg font-semibold">{formatDistance(set.distance_m)}</span>
              </>
            ) : null}
          </span>
        ) : (
          <span className="flex items-baseline tabular-nums">
            <span className="w-14 text-right text-lg font-semibold">{formatKg(set.weight_kg)}</span>
            <span className="ml-1 w-7 text-left text-[10px] uppercase tracking-wider text-muted">kg</span>
            <span className="mx-1 text-muted">·</span>
            <span className="w-8 text-right text-lg font-semibold">{set.reps}</span>
            <span className="ml-1 text-[10px] uppercase tracking-wider text-muted">reps</span>
          </span>
        )}
        {!cardio && <PrBadges set={set} />}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onStartEdit}
          className="grid h-8 w-8 place-items-center rounded-md text-muted opacity-100 transition hover:bg-card hover:text-fg sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Editar set"
          title="Editar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="grid h-8 w-8 place-items-center rounded-md text-muted opacity-100 transition hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Eliminar set"
          title="Eliminar"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>
      </div>
    </li>
  );
}

function EditWeightForm({
  initialWeight,
  initialReps,
  onCancel,
  onSave,
  onDuplicate,
}: {
  initialWeight: number;
  initialReps: number;
  onCancel: () => void;
  onSave: (weight: number, reps: number) => void | Promise<void>;
  onDuplicate?: () => void;
}) {
  const { t } = useT();
  const [w, setW] = useState(String(initialWeight));
  const [r, setR] = useState(String(initialReps));
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const weight = parseFloat(w.replace(',', '.'));
    const reps = parseInt(r, 10);
    if (isNaN(weight) || isNaN(reps) || reps <= 0) return;
    setSaving(true);
    await onSave(weight, reps);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">{t('field.weight')}</div>
          <input autoFocus type="text" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-base font-semibold tabular-nums outline-none focus:border-accent/60" />
        </label>
        <label className="flex-1">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">{t('field.reps')}</div>
          <input type="text" inputMode="numeric" value={r} onChange={(e) => setR(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-base font-semibold tabular-nums outline-none focus:border-accent/60" />
        </label>
        <button type="submit" disabled={saving}
          className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-ink transition hover:brightness-110 disabled:opacity-40" aria-label={t('action.save')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </button>
        <button type="button" onClick={onCancel}
          className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-muted transition hover:text-fg" aria-label={t('action.cancel')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>
      </div>
      {onDuplicate && (
        <button
          type="button"
          onClick={onDuplicate}
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted transition hover:border-strong hover:text-fg"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {t('action.duplicate')}
        </button>
      )}
    </form>
  );
}

function EditCardioForm({
  initialDuration,
  initialDistance,
  onCancel,
  onSave,
  onDuplicate,
}: {
  initialDuration: number;
  initialDistance: number;
  onCancel: () => void;
  onSave: (durationSec: number, distanceM: number) => void | Promise<void>;
  onDuplicate?: () => void;
}) {
  const { t } = useT();
  const [d, setD] = useState(initialDuration ? formatDuration(initialDuration) : '');
  const [km, setKm] = useState(initialDistance ? (initialDistance / 1000).toString() : '');
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const sec = parseDuration(d);
    if (!sec || sec <= 0) return;
    const kmNum = km.trim() ? parseFloat(km.replace(',', '.')) : 0;
    const meters = isNaN(kmNum) ? 0 : Math.round(kmNum * 1000);
    setSaving(true);
    await onSave(sec, meters);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">{t('field.duration')}</div>
          <input autoFocus type="text" inputMode="numeric" value={d} onChange={(e) => setD(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-base font-semibold tabular-nums outline-none focus:border-accent/60" />
        </label>
        <label className="flex-1">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">{t('field.km')}</div>
          <input type="text" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-base font-semibold tabular-nums outline-none focus:border-accent/60" />
        </label>
        <button type="submit" disabled={saving}
          className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-ink transition hover:brightness-110 disabled:opacity-40" aria-label={t('action.save')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </button>
        <button type="button" onClick={onCancel}
          className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card text-muted transition hover:text-fg" aria-label={t('action.cancel')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>
      </div>
      {onDuplicate && (
        <button
          type="button"
          onClick={onDuplicate}
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted transition hover:border-strong hover:text-fg"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {t('action.duplicate')}
        </button>
      )}
    </form>
  );
}

function QuickAddCardio({
  exerciseId,
  onAdd,
  lastSets,
}: {
  exerciseId: number;
  onAdd: (id: number, durationSec: number, distanceM: number) => void;
  lastSets: TrainingSet[];
}) {
  const { t: tLocal } = useT();
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [justAdded, setJustAdded] = useState(false);
  const durationRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  // Seed only when the exercise changes, not on every new set.
  useEffect(() => {
    const last = lastSets.at(-1);
    setDuration(last && last.duration_seconds ? formatDuration(last.duration_seconds) : '');
    setDistance(last && last.distance_m ? (last.distance_m / 1000).toString() : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    const sec = parseDuration(duration);
    if (!sec || sec <= 0) return;
    const km = distance.trim() ? parseFloat(distance.replace(',', '.')) : 0;
    const meters = isNaN(km) ? 0 : Math.round(km * 1000);
    submittingRef.current = true;
    onAdd(exerciseId, sec, meters);
    setDistance('');
    setJustAdded(true);
    setTimeout(() => { setJustAdded(false); submittingRef.current = false; }, 400);
    // No explicit focus shift — keep the mobile keyboard stable.
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <label className="flex-1">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">{tLocal('field.durationMMSS')}</div>
        <input
          ref={durationRef}
          type="text"
          inputMode="numeric"
          placeholder="30:00"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          data-quickadd-focus
          className="h-[52px] w-full rounded-xl border border-border bg-elevated px-3 text-lg font-semibold tabular-nums outline-none transition focus:border-accent/60"
        />
      </label>
      <label className="flex-1">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">{tLocal('field.distanceKm')}</div>
        <input
          type="text"
          inputMode="decimal"
          placeholder="—"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          className="h-[52px] w-full rounded-xl border border-border bg-elevated px-3 text-lg font-semibold tabular-nums outline-none transition focus:border-accent/60"
        />
      </label>
      <button
        type="submit"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl bg-accent text-ink transition hover:brightness-110 active:scale-95 disabled:opacity-40"
        disabled={!duration.trim()}
        aria-label={justAdded ? 'Añadido' : 'Añadir serie'}
      >
        {justAdded ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
        )}
      </button>
    </form>
  );
}

function CreateExerciseForm({
  initialName,
  initialCategoryId,
  categories,
  onCancel,
  onCreate,
}: {
  initialName: string;
  initialCategoryId: number | null;
  categories: Category[];
  onCancel: () => void;
  onCreate: (name: string, categoryId: number) => Promise<void> | void;
}) {
  const [name, setName] = useState(initialName);
  const [categoryId, setCategoryId] = useState<number | null>(initialCategoryId);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !categoryId || submitting) return;
    setSubmitting(true);
    await onCreate(name.trim(), categoryId);
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-xl border border-accent/40 bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="section-title">Nuevo ejercicio</div>
        <button type="button" onClick={onCancel} className="text-xs text-muted hover:text-fg">
          Cancelar
        </button>
      </div>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ej: Press Inclinado (mancuernas)"
        className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm outline-none transition focus:border-accent/60"
      />
      <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
        {categories.map((c) => {
          const active = categoryId === c.id;
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${active ? 'text-fg' : 'text-muted hover:text-fg'}`}
              style={{
                background: active ? `${c.color}33` : 'var(--color-elevated)',
                boxShadow: active ? `inset 0 0 0 1px ${c.color}80` : undefined,
              }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full align-middle mr-1.5" style={{ background: c.color ?? '#888' }} />
              {c.name}
            </button>
          );
        })}
      </div>
      <button
        type="submit"
        disabled={!name.trim() || !categoryId || submitting}
        className="mt-3 w-full rounded-lg bg-accent py-2 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
      >
        {submitting ? 'Creando…' : 'Crear y seleccionar'}
      </button>
    </form>
  );
}

function PrBadges({ set }: { set: TrainingSet }) {
  const badges: Array<{ label: string; title: string; icon: React.ReactNode }> = [];
  if (set.pr_weight) badges.push({
    label: 'W', title: 'Récord de peso máximo',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 9H20V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3h-.5a1.5 1.5 0 0 0 0 3H4v1a8 8 0 0 0 5 7.42V22a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.58A8 8 0 0 0 20 13v-1h.5a1.5 1.5 0 0 0 0-3z"/></svg>,
  });
  if (set.pr_1rm) badges.push({
    label: '1RM', title: 'Récord de 1RM estimado',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  });
  if (set.pr_reps) badges.push({
    label: 'R', title: 'Récord de repeticiones a este peso',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 2h9l1.5 3h3.5l-2.5 5a6 6 0 0 1-4.4 3.85L14 18h2v2H8v-2h2l-.6-4.15A6 6 0 0 1 5 10L2.5 5H6z"/></svg>,
  });
  if (!badges.length) return null;
  // Icon-only circular badges so three PRs never overflow the row.
  return (
    <span className="ml-1 flex flex-wrap gap-0.5">
      {badges.map((b) => (
        <span
          key={b.label}
          title={b.title}
          aria-label={b.title}
          className="grid h-5 w-5 place-items-center rounded-full bg-accent text-ink"
        >
          {b.icon}
        </span>
      ))}
    </span>
  );
}

function PrTag({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink">
      {label}
    </span>
  );
}

function formatKg(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseDuration(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n) || n < 0)) return null;
  if (parts.length === 1) return parts[0] * 60;           // "30" → 30 min
  if (parts.length === 2) return parts[0] * 60 + parts[1]; // "30:45"
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]; // "1:30:45"
  return null;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km % 1 === 0 ? km.toFixed(0) : km.toFixed(2).replace(/\.?0+$/, '')} km`;
  }
  return `${Math.round(meters)} m`;
}

function relativeDate(iso: string) {
  const diffDays = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays}d`;
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)}sem`;
  if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)}m`;
  return `hace ${Math.floor(diffDays / 365)}a`;
}
