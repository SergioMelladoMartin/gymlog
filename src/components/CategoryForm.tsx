import { useState } from 'react';
import { useLocale } from '../hooks/useLocale';
import { CATEGORY_COLORS, createCategory } from '../lib/queries';

/** Inline form to create a muscle group (name + colour). Used both in the
 *  groups index modal and inside the "create exercise" modal. */
export default function CategoryForm({
  onCreated,
  onCancel,
  autoFocus = true,
}: {
  onCreated: (id: number) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}) {
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const id = createCategory(trimmed, color);
      onCreated(id);
    } catch (err: any) {
      setError(err?.message === 'DUPLICATE_CATEGORY'
        ? t('groups.duplicate', { name: trimmed })
        : (err?.message ?? t('groups.errorCreate')));
    }
  }

  return (
    <div>
      <input
        autoFocus={autoFocus}
        value={name}
        onChange={(e) => { setName(e.target.value); setError(null); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
        }}
        placeholder={t('groups.namePlaceholder')}
        maxLength={40}
        className="w-full rounded-lg border border-border bg-elevated px-3 py-2.5 text-base outline-none transition focus:border-accent/60"
      />
      <div className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted">{t('groups.color')}</div>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={c}
            aria-pressed={color === c}
            className="h-7 w-7 rounded-full transition"
            style={{
              background: c,
              boxShadow: color === c ? `0 0 0 2px var(--color-bg), 0 0 0 4px ${c}` : undefined,
            }}
          />
        ))}
      </div>
      {error && <div className="mt-3 text-xs text-danger">{error}</div>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-border bg-elevated/60 py-2.5 text-sm font-medium text-muted transition hover:bg-elevated hover:text-fg"
        >
          {t('action.cancel')}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!name.trim()}
          className="btn-accent flex-[2] rounded-lg py-2.5 text-sm disabled:opacity-40"
        >
          {t('groups.create')}
        </button>
      </div>
    </div>
  );
}
