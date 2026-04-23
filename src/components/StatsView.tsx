import { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { getDb } from '../lib/sqlite';

type Range = 'all' | '7d' | '30d' | '90d' | '365d' | 'year';

function argbToHex(n: number | null): string | null {
  if (n == null) return null;
  const u = n >>> 0;
  return '#' + [(u >> 16) & 0xff, (u >> 8) & 0xff, u & 0xff].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export default function StatsView() {
  const ready = useDatabase();
  const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
  const range = (url?.searchParams.get('range') ?? 'all') as Range;
  const year = Number(url?.searchParams.get('year') ?? new Date().getFullYear());

  const [totals, setTotals] = useState({ total_sets: 0, total_days: 0, total_exercises: 0, total_volume: 0 });
  const [perCat, setPerCat] = useState<Array<{ id: number; name: string; color: string | null; set_count: number; volume: number }>>([]);
  const [top, setTop] = useState<Array<{ id: number; name: string; color: string | null; set_count: number }>>([]);
  const [weekday, setWeekday] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [label, setLabel] = useState('Todo el histórico');

  useEffect(() => {
    if (!ready) return;
    const db = getDb();
    const q = (sql: string, params: any[] = []) =>
      db.exec({ sql, bind: params, rowMode: 'object', returnValue: 'resultRows' }) as any[];

    // Build the range predicate once, separately for an aliased vs unaliased
    // training_log so the `date(...)` function call never gets prefixed with
    // a table alias (that was producing invalid SQL like `ts.date('now', …)`
    // and blanking the page on every range except "Todo").
    let pred = ''; let args: any[] = []; let lbl = 'Todo el histórico';
    switch (range) {
      case '7d':   pred = "DATECOL >= date('now', '-7 days')";   lbl = 'Últimos 7 días'; break;
      case '30d':  pred = "DATECOL >= date('now', '-30 days')";  lbl = 'Últimos 30 días'; break;
      case '90d':  pred = "DATECOL >= date('now', '-90 days')";  lbl = 'Últimos 90 días'; break;
      case '365d': pred = "DATECOL >= date('now', '-365 days')"; lbl = 'Últimos 12 meses'; break;
      case 'year':
        pred = 'DATECOL >= ? AND DATECOL <= ?';
        args = [`${year}-01-01`, `${year}-12-31`];
        lbl = year === new Date().getFullYear() ? 'Año en curso' : `Año ${year}`;
        break;
    }
    const where = pred ? `WHERE ${pred.replace(/DATECOL/g, 'date')}` : '';
    const whereTs = pred ? `WHERE ${pred.replace(/DATECOL/g, 'ts.date')}` : '';
    setLabel(lbl);

    const t = q(
      `SELECT COUNT(*) AS total_sets, COUNT(DISTINCT date) AS total_days,
              COUNT(DISTINCT exercise_id) AS total_exercises,
              SUM(metric_weight * reps) AS total_volume
       FROM training_log ${where}`,
      args,
    )[0];
    setTotals({
      total_sets: Number(t?.total_sets ?? 0),
      total_days: Number(t?.total_days ?? 0),
      total_exercises: Number(t?.total_exercises ?? 0),
      total_volume: Number(t?.total_volume ?? 0),
    });

    const pc = q(
      `SELECT c._id AS id, c.name, c.colour AS colour, COUNT(*) AS set_count,
              SUM(ts.metric_weight * ts.reps) AS volume
       FROM training_log ts
       JOIN exercise e ON e._id = ts.exercise_id
       JOIN Category c ON c._id = e.category_id
       ${whereTs}
       GROUP BY c._id ORDER BY volume DESC`,
      args,
    );
    setPerCat(pc.map((r: any) => ({
      id: r.id, name: r.name, color: argbToHex(r.colour),
      set_count: Number(r.set_count), volume: Number(r.volume ?? 0),
    })));

    const tp = q(
      `SELECT e._id AS id, e.name, c.colour AS colour, COUNT(*) AS set_count
       FROM training_log ts
       JOIN exercise e ON e._id = ts.exercise_id
       JOIN Category c ON c._id = e.category_id
       ${whereTs}
       GROUP BY e._id ORDER BY set_count DESC LIMIT 10`,
      args,
    );
    setTop(tp.map((r: any) => ({ id: r.id, name: r.name, color: argbToHex(r.colour), set_count: Number(r.set_count) })));

    const wk = q(
      `SELECT CAST(strftime('%w', date) AS INTEGER) AS dow, COUNT(DISTINCT date) AS c
       FROM training_log ${where} GROUP BY dow`,
      args,
    );
    const wm = new Map<number, number>();
    for (const r of wk as any[]) wm.set(Number(r.dow), Number(r.c));
    setWeekday([1, 2, 3, 4, 5, 6, 0].map((d) => wm.get(d) ?? 0));
  }, [ready, range, year]);

  if (!ready) return <div className="flex min-h-[50vh] items-center justify-center text-muted"><div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" /></div>;

  const maxVolume = perCat.reduce((a, c) => Math.max(a, c.volume), 0);
  const weekdayMax = Math.max(1, ...weekday);
  const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
  const currentYear = new Date().getFullYear();
  const chips: Array<{ id: Range; label: string; href: string; match: boolean }> = [
    { id: '7d', label: '7d', href: '/stats?range=7d', match: range === '7d' },
    { id: '30d', label: '30d', href: '/stats?range=30d', match: range === '30d' },
    { id: '90d', label: '90d', href: '/stats?range=90d', match: range === '90d' },
    { id: '365d', label: '1a', href: '/stats?range=365d', match: range === '365d' },
    { id: 'year', label: 'YTD', href: `/stats?range=year&year=${currentYear}`, match: range === 'year' && year === currentYear },
    { id: 'all', label: 'Todo', href: '/stats', match: range === 'all' },
  ];

  return (
    <>
      <div className="mb-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted">Resumen</div>
        <h1 className="text-3xl font-semibold tracking-tight">Estadísticas</h1>
        <div className="mt-1 text-sm capitalize text-muted">{label}</div>
      </div>

      <div className="no-scrollbar mb-5 -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {chips.map((c) => (
          <a key={c.id} href={c.href} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${c.match ? 'bg-accent text-ink' : 'bg-card text-muted hover:text-fg'}`}>{c.label}</a>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Días" value={String(totals.total_days)} />
        <Tile label="Sets" value={fmt(totals.total_sets)} />
        <Tile label="Ejercicios" value={String(totals.total_exercises)} />
        <Tile label="Volumen" value={`${Math.round(totals.total_volume / 1000)}k`} unit="kg" />
      </div>

      <div className="card mb-5 p-4">
        <div className="section-title mb-3">Distribución semanal</div>
        <ul className="flex flex-col gap-2 sm:hidden">
          {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((l, i) => {
            const v = weekday[i];
            const pct = weekdayMax ? (v / weekdayMax) * 100 : 0;
            return (
              <li key={l} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs font-medium text-muted">{l}</span>
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-elevated">
                  <div className="h-full rounded-md bg-accent transition" style={{ width: `${pct}%`, opacity: v ? 0.45 + 0.55 * (v / weekdayMax) : 0.25 }} />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums">{v}</span>
              </li>
            );
          })}
        </ul>
        <div className="hidden items-end gap-2 sm:flex">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((l, i) => {
            const v = weekday[i];
            const h = Math.max(4, (v / weekdayMax) * 72);
            return (
              <div key={l} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-20 w-full items-end">
                  <div className="w-full rounded-t bg-accent transition" style={{ height: `${h}px`, opacity: v ? 0.35 + 0.65 * (v / weekdayMax) : 0.15 }} />
                </div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted">{l}</div>
                <div className="text-[11px] tabular-nums text-fg">{v}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card mb-5 p-4">
        <div className="section-title mb-3">Volumen por categoría</div>
        {perCat.length === 0 ? <div className="py-6 text-center text-sm text-muted">Sin datos.</div> : (
          <ul className="flex flex-col gap-3">
            {perCat.map((c) => (
              <li key={c.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color ?? '#888' }} />
                    <span className="font-medium">{c.name}</span>
                  </span>
                  <span className="tabular-nums text-muted">{fmt(c.volume)} kg · {c.set_count} sets</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-elevated">
                  <div className="h-full rounded-full transition-all" style={{ width: `${maxVolume ? (c.volume / maxVolume) * 100 : 0}%`, background: c.color ?? '#888', boxShadow: `0 0 8px ${c.color ?? 'transparent'}55` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-4">
        <div className="section-title mb-2">Top 10 ejercicios</div>
        {top.length === 0 ? <div className="py-6 text-center text-sm text-muted">Sin datos.</div> : (
          <ul className="divide-y divide-border">
            {top.map((e, i) => (
              <li key={e.id}>
                <a href={`/exercise?id=${e.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 text-sm transition hover:bg-elevated">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">{i + 1}</span>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.color ?? '#888' }} />
                    <span className="truncate">{e.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">{e.set_count}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
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
