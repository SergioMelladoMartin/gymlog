import { useEffect, useState } from 'react';
import { isSignedIn } from '../lib/auth';
import { loadDatabase, onStatusChange, getStatus } from '../lib/sqlite';
import { getCategories, getExercises, getSetsForDate, todayISO } from '../lib/queries';

export default function HomeView() {
  const [status, setStatus] = useState(getStatus().status);
  const [data, setData] = useState<{ cats: number; exs: number; todaySets: number } | null>(null);

  useEffect(() => {
    if (!isSignedIn() && !import.meta.env.DEV) {
      window.location.replace('/login');
      return;
    }
    const off = onStatusChange((s) => setStatus(s));
    loadDatabase({ seedUrl: '/seed.fitnotes' }).catch(console.error);
    return off;
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    try {
      const cats = getCategories();
      const exs = getExercises();
      const todaySets = getSetsForDate(todayISO());
      setData({ cats: cats.length, exs: exs.length, todaySets: todaySets.length });
    } catch (e) {
      console.error('query failed', e);
    }
  }, [status]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        <span className="text-sm">Cargando tu base de datos…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        No se pudo cargar la base de datos. Revisa la consola.
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <h2 className="text-xl font-semibold tracking-tight">Sin backup todavía</h2>
        <p className="mt-2 text-sm text-muted">
          Sube tu archivo <code>.fitnotes</code> desde la pantalla de acceso o empieza desde cero.
        </p>
        <a href="/login" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink">
          Ir al acceso
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium uppercase tracking-wider text-muted">Entreno</div>
        <h1 className="text-3xl font-semibold capitalize tracking-tight">Hoy</h1>
      </div>

      <div className="card p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Checkpoint</h2>
        <p className="mb-4 text-sm text-muted">
          Conectado a SQLite-WASM. Datos leídos del archivo <code>.fitnotes</code>:
        </p>
        {data ? (
          <ul className="space-y-2 text-sm tabular-nums">
            <li className="flex justify-between"><span>Categorías</span><b>{data.cats}</b></li>
            <li className="flex justify-between"><span>Ejercicios</span><b>{data.exs}</b></li>
            <li className="flex justify-between"><span>Sets hoy</span><b>{data.todaySets}</b></li>
          </ul>
        ) : (
          <div className="text-sm text-muted">Leyendo…</div>
        )}
        <p className="mt-4 border-t border-border pt-4 text-xs text-muted">
          La UI completa (Calendario, Diario, Stats, logger con animaciones, editor de ejercicios, tema y picker de color) vuelve en el siguiente commit sobre esta base.
        </p>
      </div>
    </div>
  );
}
