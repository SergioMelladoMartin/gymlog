import { useState } from 'react';
import type { Category } from '../lib/types';
import { countExerciseSets, deleteExercise, updateExercise } from '../lib/queries';

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
  const [deleting, setDeleting] = useState(false);

  function handleDelete() {
    const setCount = countExerciseSets(exerciseId);
    const msg =
      setCount > 0
        ? `Borrar "${initialName}" también eliminará ${setCount} ${setCount === 1 ? 'serie registrada' : 'series registradas'}. Esta acción no se puede deshacer. ¿Continuar?`
        : `Borrar "${initialName}"? Esta acción no se puede deshacer.`;
    if (!window.confirm(msg)) return;
    setDeleting(true);
    try {
      deleteExercise(exerciseId);
      window.location.assign('/exercises');
    } catch (err: any) {
      alert(err?.message ?? 'Error al borrar');
      setDeleting(false);
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      updateExercise(exerciseId, { name: name.trim(), category_id: catId });
      window.location.reload();
    } catch (err: any) {
      alert(err?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
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
        disabled={!name.trim() || saving || deleting}
        className="mt-3 w-full rounded-lg bg-accent py-2 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={saving || deleting}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-danger/40 bg-danger/10 py-2 text-sm font-medium text-danger transition hover:bg-danger/20 disabled:opacity-40"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
        {deleting ? 'Borrando…' : 'Borrar ejercicio'}
      </button>
    </form>
  );
}
