import { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { getCategories, getExercises, type ExerciseExtra } from '../lib/queries';
import type { Category } from '../lib/types';
import ExerciseList from './ExerciseList';

export default function ExercisesView() {
  const ready = useDatabase();
  const [exercises, setExercises] = useState<ExerciseExtra[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!ready) return;
    setCategories(getCategories());
    setExercises(getExercises());
  }, [ready]);

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
        <h1 className="text-3xl font-semibold tracking-tight">
          {activeCategory ? (
            <span className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: activeCategory.color ?? '#888' }} />
              {activeCategory.name}
            </span>
          ) : 'Ejercicios'}
        </h1>
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
    </>
  );
}
