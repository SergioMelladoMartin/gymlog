import { useEffect, useState } from 'react';
import { getCurrentUser, type UserProfile } from '../lib/auth';
import { getDb } from '../lib/sqlite';
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

      <a href="/settings"
        className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition hover:border-strong hover:bg-elevated">
        <span className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Ajustes
        </span>
        <svg className="text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </a>
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
