import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDatabase } from '../hooks/useDatabase';
import { createExercise as qCreateExercise, getCategories, getExercises, type ExerciseExtra } from '../lib/queries';
import type { Category } from '../lib/types';
import ExerciseList from './ExerciseList';

export default function ExercisesView() {
  const ready = useDatabase();
  const [exercises, setExercises] = useState<ExerciseExtra[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creatorOpen, setCreatorOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setCategories(getCategories());
    setExercises(getExercises());
  }, [ready]);

  function refreshExercises() {
    setExercises(getExercises());
  }

  const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
  const query = url?.searchParams.get('q') ?? '';
  const groupParam = url?.searchParams.get('group');
  const groupId = groupParam ? Number(groupParam) : null;

  if (!ready) return <div className="flex min-h-[50vh] items-center justify-center text-muted"><div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" /></div>;

  const countByCat = new Map<number, number>();
  for (const e of exercises) countByCat.set(e.category_id, (countByCat.get(e.category_id) ?? 0) + 1);

  const activeCategory = groupId ? categories.find((c) => c.id === groupId) ?? null : null;
  const isSearching = query.trim().length > 0;
  const showGroupsIndex = !isSearching && groupId === null;

  return (
    <>
      <div className="mb-4">
        {activeCategory ? (
          <a href="/exercises" className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-fg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Grupos
          </a>
        ) : (
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Catálogo</div>
        )}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {activeCategory ? (
              <span className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: activeCategory.color ?? '#888' }} />
                {activeCategory.name}
              </span>
            ) : 'Ejercicios'}
          </h1>
          <button
            type="button"
            onClick={() => setCreatorOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-xs font-semibold text-ink transition hover:brightness-110"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
            Crear ejercicio
          </button>
        </div>
      </div>

      {showGroupsIndex ? (
        <>
          <div className="mb-3 text-xs text-muted">Elige un grupo muscular para ver sus ejercicios</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((c) => {
              const n = countByCat.get(c.id) ?? 0;
              return (
                <a key={c.id} href={`/exercises?group=${c.id}`} className="group relative flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-strong hover:shadow-lg">
                  <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color ?? '#888', boxShadow: `0 0 10px ${c.color ?? '#888'}55` }} />
                      <span className="truncate font-semibold">{c.name}</span>
                    </span>
                    <span className="mt-1 text-xs text-muted">{n} ejercicio{n === 1 ? '' : 's'}</span>
                  </div>
                  <svg className="shrink-0 text-muted transition group-hover:text-fg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </a>
              );
            })}
          </div>
          <div className="mt-6">
            <a href="/exercises?q=_all" className="block rounded-xl border border-dashed border-border bg-card/50 p-3 text-center text-sm text-muted transition hover:bg-card hover:text-fg">
              Ver todos los ejercicios ({exercises.length})
            </a>
          </div>
        </>
      ) : (
        <ExerciseList
          exercises={exercises}
          categories={categories}
          initialCategory={groupId ?? null}
          initialQuery={query === '_all' ? '' : query}
        />
      )}

      {creatorOpen && (
        <CreateExerciseModal
          categories={categories}
          defaultCategoryId={groupId ?? categories[0]?.id ?? null}
          onClose={() => setCreatorOpen(false)}
          onCreated={(id) => {
            refreshExercises();
            setCreatorOpen(false);
            // Drop the user straight into the new exercise's detail page.
            window.location.assign(`/exercise?id=${id}`);
          }}
        />
      )}
    </>
  );
}

function CreateExerciseModal({
  categories,
  defaultCategoryId,
  onClose,
  onCreated,
}: {
  categories: Category[];
  defaultCategoryId: number | null;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(defaultCategoryId);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !categoryId || submitting) return;
    setSubmitting(true);
    try {
      const id = qCreateExercise(trimmed, categoryId);
      onCreated(id);
    } catch (err: any) {
      alert(err?.message ?? 'Error al crear ejercicio');
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Crear ejercicio</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-elevated hover:text-fg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Press inclinado (mancuernas)"
          className="w-full rounded-lg border border-border bg-elevated px-3 py-2.5 text-base outline-none transition focus:border-accent/60"
        />
        <div className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted">Grupo muscular</div>
        <div className="no-scrollbar -mx-1 mt-1.5 flex flex-wrap gap-1.5 px-1">
          {categories.map((c) => {
            const active = categoryId === c.id;
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${active ? 'text-fg' : 'text-muted hover:text-fg'}`}
                style={{
                  background: active ? `${c.color}33` : 'var(--color-elevated)',
                  boxShadow: active ? `inset 0 0 0 1px ${c.color}80` : undefined,
                }}
              >
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: c.color ?? '#888' }} />
                {c.name}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-muted transition hover:text-fg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !categoryId || submitting}
            className="flex-[2] rounded-lg bg-accent py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
          >
            {submitting ? 'Creando…' : 'Crear y abrir'}
          </button>
        </div>
      </form>
    </div>
  );

  return createPortal(overlay, document.body);
}
