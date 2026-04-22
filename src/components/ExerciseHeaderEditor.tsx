import { useState } from 'react';
import type { Category } from '../lib/queries';

interface Props {
  exerciseId: number;
  initialName: string;
  initialCategoryId: number;
  categoryName: string;
  categoryColor: string | null;
  categories: Category[];
}

export default function ExerciseHeaderEditor({
  exerciseId,
  initialName,
  initialCategoryId,
  categoryName,
  categoryColor,
  categories,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [catId, setCatId] = useState(initialCategoryId);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    const res = await fetch(`/api/exercises/${exerciseId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), category_id: catId }),
    });
    setSaving(false);
    if (res.ok) {
      window.location.reload();
    } else {
      const err = await res.json().catch(() => ({ error: 'Error al guardar' }));
      alert(err.error || 'Error al guardar');
    }
  }

  if (!editing) {
    const currentCat = categories.find((c) => c.id === catId);
    return (
      <div>
        <div className="flex items-center gap-2.5">
          <span className="h-3 w-3 rounded-full" style={{ background: (currentCat?.color ?? categoryColor) ?? '#888' }} />
          <h1 className="text-2xl font-semibold tracking-tight">{initialName}</h1>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-1 grid h-7 w-7 place-items-center rounded-md border border-border bg-card text-muted transition hover:text-fg"
            aria-label="Editar ejercicio"
            title="Editar nombre y categoría"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
        <div className="mt-1 text-sm text-muted">{currentCat?.name ?? categoryName}</div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-accent/40 bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="section-title">Editar ejercicio</div>
        <button type="button" onClick={() => { setName(initialName); setCatId(initialCategoryId); setEditing(false); }} className="text-xs text-muted hover:text-fg">
          Cancelar
        </button>
      </div>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-lg font-semibold outline-none transition focus:border-accent/60"
      />
      <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
        {categories.map((c) => {
          const active = catId === c.id;
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => setCatId(c.id)}
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
        disabled={!name.trim() || saving}
        className="mt-3 w-full rounded-lg bg-accent py-2 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
