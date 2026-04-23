import { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { getDayPrCounts } from '../lib/queries';
import { getDb } from '../lib/sqlite';

interface DayRow {
  date: string;
  exercise_count: number;
  set_count: number;
  volume: number;
}

interface BreakdownRow {
  date: string;
  exercise_name: string;
  category_color: string | null;
  sets: number;
  top_weight: number;
  top_reps: number;
}

function argbToHex(n: number | null): string | null {
  if (n == null) return null;
  const u = n >>> 0;
  return '#' + [(u >> 16) & 0xff, (u >> 8) & 0xff, u & 0xff].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return {
    weekday: d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''),
    day: d.getDate(),
    month: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
    year: d.getFullYear(),
  };
}

export default function DiaryView() {
  const ready = useDatabase();
  const [days, setDays] = useState<DayRow[]>([]);
  const [breakdown, setBreakdown] = useState<Map<string, BreakdownRow[]>>(new Map());
  const [comments, setComments] = useState<Map<string, string>>(new Map());
  const [prs, setPrs] = useState<Map<string, { pr_weight: number; pr_1rm: number; pr_reps: number }>>(new Map());
  const [hasOlder, setHasOlder] = useState(false);
  const [hasNewer, setHasNewer] = useState(false);

  const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
  const before = url?.searchParams.get('before') ?? null;
  const after = url?.searchParams.get('after') ?? null;
  const paged = !!(before || after);
  const limit = 30;

  useEffect(() => {
    if (!ready) return;
    const db = getDb();
    const query = (sql: string, params: any[] = []) =>
      db.exec({ sql, bind: params, rowMode: 'object', returnValue: 'resultRows' }) as any[];

    let rows: DayRow[] = [];
    if (before) {
      rows = query(
        `SELECT date, COUNT(DISTINCT exercise_id) AS exercise_count, COUNT(*) AS set_count,
                SUM(metric_weight * reps) AS volume
         FROM training_log WHERE date < ?
         GROUP BY date ORDER BY date DESC LIMIT ?`,
        [before, limit],
      );
    } else if (after) {
      rows = query(
        `SELECT date, exercise_count, set_count, volume FROM (
           SELECT date, COUNT(DISTINCT exercise_id) AS exercise_count, COUNT(*) AS set_count,
                  SUM(metric_weight * reps) AS volume
           FROM training_log WHERE date > ?
           GROUP BY date ORDER BY date ASC LIMIT ?
         ) sub ORDER BY date DESC`,
        [after, limit],
      );
    } else {
      rows = query(
        `SELECT date, COUNT(DISTINCT exercise_id) AS exercise_count, COUNT(*) AS set_count,
                SUM(metric_weight * reps) AS volume
         FROM training_log GROUP BY date ORDER BY date DESC LIMIT ?`,
        [limit],
      );
    }
    rows = rows.map((r: any) => ({ ...r, volume: Number(r.volume), set_count: Number(r.set_count), exercise_count: Number(r.exercise_count) }));
    setDays(rows);

    if (rows.length) {
      const placeholders = rows.map(() => '?').join(',');
      const bd = query(
        `SELECT ts.date, e.name AS exercise_name, c.colour AS category_colour,
                COUNT(*) AS sets, MAX(ts.metric_weight) AS top_weight, MAX(ts.reps) AS top_reps
         FROM training_log ts
         JOIN exercise e ON e._id = ts.exercise_id
         JOIN Category c ON c._id = e.category_id
         WHERE ts.date IN (${placeholders})
         GROUP BY ts.date, ts.exercise_id
         ORDER BY ts.date DESC, MIN(ts._id) ASC`,
        rows.map((d) => d.date),
      );
      const bm = new Map<string, BreakdownRow[]>();
      for (const r of bd as any[]) {
        const rec: BreakdownRow = {
          date: r.date,
          exercise_name: r.exercise_name,
          category_color: argbToHex(r.category_colour),
          sets: Number(r.sets),
          top_weight: Number(r.top_weight),
          top_reps: Number(r.top_reps),
        };
        if (!bm.has(rec.date)) bm.set(rec.date, []);
        bm.get(rec.date)!.push(rec);
      }
      setBreakdown(bm);

      const cm = query(
        `SELECT date, comment FROM WorkoutComment WHERE date IN (${placeholders})`,
        rows.map((d) => d.date),
      );
      const cmap = new Map<string, string>();
      for (const r of cm as any[]) cmap.set(r.date, r.comment);
      setComments(cmap);

      setPrs(getDayPrCounts(rows.map((d) => d.date)));

      const oldest = rows.at(-1)?.date;
      const newest = rows[0]?.date;
      setHasOlder(!!oldest && !!db.selectValue('SELECT EXISTS(SELECT 1 FROM training_log WHERE date < ?) AS has', [oldest]));
      setHasNewer(!!newest && paged && !!db.selectValue('SELECT EXISTS(SELECT 1 FROM training_log WHERE date > ?) AS has', [newest]));
    }
  }, [ready, before, after]);

  if (!ready) return <div className="flex min-h-[50vh] items-center justify-center text-muted"><div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" /></div>;

  const oldestDate = days.at(-1)?.date;
  const newestDate = days[0]?.date;

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Histórico</div>
          <h1 className="text-3xl font-semibold tracking-tight">Diario</h1>
        </div>
        {paged && (
          <a href="/diary" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition hover:text-fg">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></svg>
            Inicio
          </a>
        )}
      </div>

      {days.length === 0 ? (
        <p className="text-muted">No hay entrenos registrados todavía.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map((d) => {
            const exs = breakdown.get(d.date) ?? [];
            const note = comments.get(d.date);
            const f = formatDate(d.date);
            const pr = prs.get(d.date);
            const prTotal = (pr?.pr_weight ?? 0) + (pr?.pr_1rm ?? 0) + (pr?.pr_reps ?? 0);
            return (
              <a key={d.date} href={`/day?d=${d.date}`} className="group card flex overflow-hidden transition hover:border-strong">
                <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r border-border bg-elevated px-3 py-4 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{f.weekday}</div>
                  <div className="text-3xl font-semibold leading-none tabular-nums tracking-tight">{f.day}</div>
                  <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted">{f.month} · {String(f.year).slice(2)}</div>
                </div>
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {[...new Set(exs.map((e) => e.category_color).filter(Boolean))].slice(0, 4).map((c, i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: c! }} />
                      ))}
                      {prTotal > 0 && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-ink">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 2h9l1.5 3h3.5l-2.5 5a6 6 0 0 1-4.4 3.85L14 18h2v2H8v-2h2l-.6-4.15A6 6 0 0 1 5 10L2.5 5H6z"/></svg>
                          {prTotal}
                        </span>
                      )}
                    </div>
                    <div className="text-xs tabular-nums text-muted">
                      {d.exercise_count} ej · {d.set_count} sets · {Math.round(d.volume).toLocaleString('es-ES')} kg
                    </div>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {exs.map((e, i) => (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 truncate">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.category_color ?? '#888' }} />
                          <span className="truncate">{e.exercise_name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted">{e.sets}× · top {e.top_weight}×{e.top_reps}</span>
                      </li>
                    ))}
                  </ul>
                  {note && <p className="mt-3 rounded-md border-l-2 border-accent/70 bg-elevated/40 py-1.5 pl-3 text-xs italic text-subtle">{note}</p>}
                </div>
              </a>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        {hasNewer && newestDate ? (
          <a href={`/diary?after=${newestDate}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted transition hover:text-fg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Más recientes
          </a>
        ) : paged ? (
          <a href="/diary" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted transition hover:text-fg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Volver al inicio
          </a>
        ) : <span />}
        {hasOlder && oldestDate && (
          <a href={`/diary?before=${oldestDate}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted transition hover:text-fg">
            Más antiguos
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </a>
        )}
      </div>
    </>
  );
}
