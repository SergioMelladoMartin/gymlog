import { useEffect, useState } from 'react';
import { getCurrentUser, signOut, type UserProfile } from '../lib/auth';
import { getDb, resetLocal } from '../lib/sqlite';
import { useDatabase } from '../hooks/useDatabase';

interface Stats {
  totalSets: number;
  totalDays: number;
  totalExercises: number;
  totalVolume: number;
  firstDay: string | null;
  lastDay: string | null;
}

export default function ProfileView() {
  const ready = useDatabase();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { setUser(getCurrentUser()); }, []);

  useEffect(() => {
    if (!ready) return;
    const db = getDb();
    const row = db.exec({
      sql: `SELECT COUNT(*) AS total_sets,
                   COUNT(DISTINCT date) AS total_days,
                   COUNT(DISTINCT exercise_id) AS total_exercises,
                   COALESCE(SUM(metric_weight * reps), 0) AS total_volume,
                   MIN(date) AS first_day, MAX(date) AS last_day
            FROM training_log`,
      rowMode: 'object',
      returnValue: 'resultRows',
    })[0] as any;
    setStats({
      totalSets: Number(row?.total_sets ?? 0),
      totalDays: Number(row?.total_days ?? 0),
      totalExercises: Number(row?.total_exercises ?? 0),
      totalVolume: Number(row?.total_volume ?? 0),
      firstDay: row?.first_day ?? null,
      lastDay: row?.last_day ?? null,
    });
  }, [ready]);

  async function logout() {
    await signOut();
    await resetLocal();
    window.location.replace('/login');
  }

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
  const prettyDate = (iso: string | null) =>
    iso ? new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  return (
    <>
      <div className="mb-4">
        <a href="/" className="mb-2 inline-flex items-center gap-1 text-sm text-muted transition hover:text-fg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Volver
        </a>
        <h1 className="text-3xl font-semibold tracking-tight">Perfil</h1>
      </div>

      <section className="card mb-5 flex items-center gap-4 p-5">
        {user?.picture ? (
          <img
            src={user.picture}
            alt=""
            className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-accent ring-offset-2 ring-offset-bg"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-accent text-3xl font-bold text-ink">
            {(user?.name ?? '?').trim().charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-semibold tracking-tight">{user?.name ?? 'Usuario'}</div>
          <div className="truncate text-sm text-muted">{user?.email ?? ''}</div>
          <div className="mt-1 text-[11px] text-muted">Conectado con Google</div>
        </div>
      </section>

      {stats && stats.totalSets > 0 && (
        <section className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Días" value={String(stats.totalDays)} />
          <Tile label="Sets" value={fmt(stats.totalSets)} />
          <Tile label="Ejercicios" value={String(stats.totalExercises)} />
          <Tile label="Volumen" value={`${Math.round(stats.totalVolume / 1000)}k`} unit="kg" />
        </section>
      )}

      {stats && stats.firstDay && (
        <section className="card mb-5 p-4">
          <div className="section-title mb-2">Registro</div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Primer entreno</span>
            <span className="capitalize">{prettyDate(stats.firstDay)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted">Último entreno</span>
            <span className="capitalize">{prettyDate(stats.lastDay)}</span>
          </div>
        </section>
      )}

      <section className="card mb-5 p-4">
        <div className="section-title mb-3">Almacenamiento</div>
        <p className="text-sm text-muted">
          Tus datos se guardan en un único archivo <code className="rounded bg-elevated px-1.5 py-0.5">gymlog.fitnotes</code>
          {' '}dentro de la carpeta oculta <b>appdata</b> de tu Google Drive. Compatible con la app FitNotes del móvil:
          puedes abrirlo ahí y los cambios vuelven a sincronizarse.
        </p>
      </section>

      <button
        type="button"
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger transition hover:bg-danger/20"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
        Cerrar sesión
      </button>
    </>
  );
}

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="stat-tile">
      <div className="section-title">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
        {value}{unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
      </div>
    </div>
  );
}
