import { useMemo, useState } from 'react';
import type { Category } from '../lib/types';
import type { ExerciseExtra as Exercise } from '../lib/queries';

interface Props {
  exercises: Exercise[];
  categories: Category[];
  initialCategory?: number | null;
  initialQuery?: string;
}

export default function ExerciseList({ exercises, categories, initialCategory = null, initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [catFilter, setCatFilter] = useState<number | null>(initialCategory);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (catFilter != null && e.category_id !== catFilter) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exercises, query, catFilter]);

  const grouped = useMemo(() => {
    const byCat = new Map<number, Exercise[]>();
    for (const e of filtered) {
      if (!byCat.has(e.category_id)) byCat.set(e.category_id, []);
      byCat.get(e.category_id)!.push(e);
    }
    return categories.filter((c) => byCat.has(c.id)).map((c) => ({ category: c, exercises: byCat.get(c.id)! }));
  }, [filtered, categories]);

  const totalCount = filtered.length;
  const countsByCat = useMemo(() => {
    const map = new Map<number, number>();
    for (const e of exercises) map.set(e.category_id, (map.get(e.category_id) ?? 0) + 1);
    return map;
  }, [exercises]);

  return (
    <div>
      <div className="sticky top-[64px] z-20 -mx-4 bg-bg/80 px-4 pb-3 backdrop-blur-xl sm:top-[58px]">
        <div className="relative mb-2">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            placeholder="Buscar ejercicio…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-card pl-9 pr-10 py-2.5 text-[15px] outline-none transition focus:border-accent/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-md text-muted transition hover:bg-elevated hover:text-fg"
              aria-label="Limpiar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          <button
            type="button"
            onClick={() => setCatFilter(null)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              catFilter === null ? 'bg-accent text-ink' : 'bg-card text-muted hover:text-fg'
            }`}
          >
            Todos <span className="ml-1 opacity-70">{exercises.length}</span>
          </button>
          {categories.map((c) => {
            const active = catFilter === c.id;
            const n = countsByCat.get(c.id) ?? 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatFilter(c.id === catFilter ? null : c.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${active ? 'text-fg' : 'text-muted hover:text-fg'}`}
                style={{
                  background: active ? `${c.color}33` : 'var(--color-card)',
                  boxShadow: active ? `inset 0 0 0 1px ${c.color}80` : undefined,
                }}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full align-middle mr-1.5" style={{ background: c.color ?? '#888' }} />
                {c.name} <span className="ml-1 opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 mb-3 flex items-center justify-between text-xs text-muted">
        <span>{totalCount} ejercicio{totalCount === 1 ? '' : 's'}</span>
      </div>

      {totalCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted">
          Sin resultados para tu búsqueda.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(({ category, exercises: list }) => (
            <section key={category.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: category.color ?? '#888' }} />
                <h2 className="section-title">{category.name}</h2>
                <span className="text-[11px] text-muted">· {list.length}</span>
              </div>
              <ul className="card divide-y divide-border">
                {list.map((e) => (
                  <li key={e.id}>
                    <a href={`/exercise?id=${e.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-elevated">
                      <span className="min-w-0 truncate">{e.name}</span>
                      <span className="shrink-0 text-xs text-muted">{formatDate(e.last_used)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  if (diff < 30) return `hace ${diff}d`;
  if (diff < 365) return `hace ${Math.floor(diff / 30)}m`;
  return `hace ${Math.floor(diff / 365)}a`;
}
