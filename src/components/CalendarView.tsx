import { useEffect, useMemo, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { getDayPrCounts, getTrainingDaysInRange, todayISO } from '../lib/queries';

type View = 'month' | 'year';

export default function CalendarView() {
  const ready = useDatabase();
  const now = new Date();
  const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
  const view = (url?.searchParams.get('view') ?? 'month') as View;
  const year = Number(url?.searchParams.get('year') ?? now.getFullYear());
  const month = Number(url?.searchParams.get('month') ?? now.getMonth() + 1);
  const today = todayISO();

  const pad = (n: number) => String(n).padStart(2, '0');
  const [rangeFrom, rangeTo] = view === 'year'
    ? [`${year}-01-01`, `${year}-12-31`]
    : [`${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`];

  const [days, setDays] = useState<Awaited<ReturnType<typeof getTrainingDaysInRange>>>([]);
  const [prs, setPrs] = useState<Map<string, { pr_weight: number; pr_1rm: number; pr_reps: number }>>(new Map());

  useEffect(() => {
    if (!ready) return;
    const d = getTrainingDaysInRange(rangeFrom, rangeTo);
    setDays(d);
    setPrs(getDayPrCounts(d.map((x) => x.date)));
  }, [ready, rangeFrom, rangeTo]);

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const totalDays = days.length;
  const totalSets = days.reduce((a, d) => a + d.set_count, 0);
  const totalVolume = days.reduce((a, d) => a + d.total_volume, 0);

  if (!ready) return <Loading />;

  // Month grid
  const first = new Date(year, month - 1, 1);
  const lastDate = new Date(year, month, 0);
  const firstWeekday = (first.getDay() + 6) % 7;
  const cells: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= lastDate.getDate(); d++) cells.push({ iso: `${year}-${pad(month)}-${pad(d)}`, day: d });
  while (cells.length % 7 !== 0) cells.push(null);

  const prevM = new Date(year, month - 2, 1);
  const nextM = new Date(year, month, 1);
  const monthName = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  // Heatmap for year view
  interface HeatCell { iso: string; dow: number; col: number; trained: boolean; sets: number; hasPr: boolean }
  const heatCells: HeatCell[] = [];
  if (view === 'year') {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);
    const firstCol = new Date(startOfYear);
    firstCol.setDate(firstCol.getDate() - ((firstCol.getDay() + 6) % 7));
    let col = 0;
    const cursor = new Date(firstCol);
    while (cursor <= endOfYear) {
      for (let dow = 0; dow < 7; dow++) {
        if (cursor.getFullYear() === year) {
          const iso = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
          const info = byDate.get(iso);
          const pr = prs.get(iso);
          heatCells.push({
            iso, dow, col,
            trained: !!info,
            sets: info?.set_count ?? 0,
            hasPr: !!pr && (pr.pr_weight + pr.pr_1rm + pr.pr_reps) > 0,
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      col++;
    }
  }
  const totalCols = heatCells.length ? Math.max(...heatCells.map((c) => c.col)) + 1 : 0;
  const intensity = (s: number) => (!s ? 0 : s <= 5 ? 1 : s <= 10 ? 2 : s <= 18 ? 3 : 4);

  const monthLabels = view === 'year' ? Array.from({ length: 12 }, (_, i) => {
    const d = new Date(year, i, 1);
    const col = heatCells.find((c) => c.iso === `${year}-${pad(i + 1)}-01`)?.col ?? 0;
    return { label: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''), col };
  }) : [];

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        {view === 'year' ? (
          <>
            <a href={`/calendar?view=year&year=${year - 1}`} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted transition hover:text-fg" aria-label="Año anterior">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </a>
            <h1 className="text-xl font-semibold tracking-tight">{year}</h1>
            <a href={`/calendar?view=year&year=${year + 1}`} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted transition hover:text-fg" aria-label="Año siguiente">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </a>
          </>
        ) : (
          <>
            <a href={`/calendar?year=${prevM.getFullYear()}&month=${prevM.getMonth() + 1}`} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted transition hover:text-fg" aria-label="Mes anterior">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </a>
            <h1 className="text-xl font-semibold capitalize tracking-tight">{monthName}</h1>
            <a href={`/calendar?year=${nextM.getFullYear()}&month=${nextM.getMonth() + 1}`} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted transition hover:text-fg" aria-label="Mes siguiente">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </a>
          </>
        )}
      </div>

      <div className="mb-4 flex items-center justify-center gap-1 rounded-full border border-border bg-card p-1 text-xs font-medium">
        <a href={`/calendar?year=${year}&month=${month}`} className={`rounded-full px-4 py-1.5 transition ${view === 'month' ? 'bg-accent text-ink' : 'text-muted hover:text-fg'}`}>Mes</a>
        <a href={`/calendar?view=year&year=${year}`} className={`rounded-full px-4 py-1.5 transition ${view === 'year' ? 'bg-accent text-ink' : 'text-muted hover:text-fg'}`}>Año</a>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <Stat label="Días" value={String(totalDays)} />
        <Stat label="Sets" value={String(totalSets)} />
        <Stat label="Volumen" value={`${Math.round(totalVolume / 1000)}k`} />
      </div>

      {view === 'month' ? (
        <>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase tracking-wider text-muted">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1.5">
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} className="aspect-square" />;
              const info = byDate.get(cell.iso);
              const isToday = cell.iso === today;
              const colors = info?.categories ? info.categories.split(',').filter(Boolean) : [];
              const trained = !!info;
              const pr = prs.get(cell.iso);
              const hasPr = pr && (pr.pr_weight + pr.pr_1rm + pr.pr_reps) > 0;

              let cellCls = 'group relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm tabular-nums transition ';
              cellCls += trained
                ? 'border border-strong bg-card hover:border-accent hover:-translate-y-0.5 hover:shadow-lg '
                : 'border border-border/40 bg-transparent text-muted hover:border-border hover:bg-card ';
              if (isToday) cellCls += 'ring-2 ring-accent ring-offset-2 ring-offset-bg ';

              return (
                <a key={cell.iso} href={`/day?d=${cell.iso}`} className={cellCls}>
                  {hasPr && (
                    <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-ink" title="Récord">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 2h9l1.5 3h3.5l-2.5 5a6 6 0 0 1-4.4 3.85L14 18h2v2H8v-2h2l-.6-4.15A6 6 0 0 1 5 10L2.5 5H6z"/></svg>
                    </span>
                  )}
                  <span className={`text-base font-semibold ${trained ? 'text-fg' : ''}`}>{cell.day}</span>
                  {colors.length > 0 && (
                    <div className="mt-1 flex gap-0.5">
                      {colors.slice(0, 4).map((c, j) => (
                        <span key={j} className="h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: '0 0 0 1px rgba(0,0,0,0.4)' }} />
                      ))}
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        </>
      ) : (
        <div className="card overflow-hidden p-4">
          <div className="mb-2 overflow-x-auto">
            <div className="relative" style={{ minWidth: `${totalCols * 14 + 28}px` }}>
              <div className="mb-1 ml-7 h-4 text-[10px] font-medium uppercase tracking-wider text-muted">
                <div className="relative h-full">
                  {monthLabels.map((m) => (
                    <span key={m.label} className="absolute top-0" style={{ left: `${m.col * 14}px` }}>{m.label}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                <div className="flex w-5 flex-col justify-between pt-0.5 text-[10px] uppercase text-muted">
                  <span>Lu</span><span>Mi</span><span>Vi</span><span>Do</span>
                </div>
                <div className="relative" style={{ width: `${totalCols * 14}px`, height: `${7 * 14}px` }}>
                  {heatCells.map((hc) => {
                    const level = intensity(hc.sets);
                    const isToday = hc.iso === today;
                    const bg = level === 0 ? 'color-mix(in srgb, var(--color-border) 40%, transparent)'
                      : level === 1 ? 'color-mix(in srgb, var(--color-accent) 25%, var(--color-card))'
                      : level === 2 ? 'color-mix(in srgb, var(--color-accent) 50%, var(--color-card))'
                      : level === 3 ? 'color-mix(in srgb, var(--color-accent) 75%, var(--color-card))'
                      : 'var(--color-accent)';
                    return (
                      <a key={hc.iso} href={`/day?d=${hc.iso}`}
                        title={hc.trained ? `${hc.iso} — ${hc.sets} sets${hc.hasPr ? ' · PR' : ''}` : `${hc.iso} — sin entreno`}
                        className={`absolute rounded-sm transition hover:scale-125 ${isToday ? 'ring-1 ring-fg' : ''}`}
                        style={{ left: `${hc.col * 14}px`, top: `${hc.dow * 14}px`, width: '11px', height: '11px', background: bg }}
                      >
                        {hc.hasPr && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-accent ring-1 ring-bg" />}
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <div className="section-title">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
    </div>
  );
}

function Loading() {
  return <div className="flex min-h-[50vh] items-center justify-center text-muted"><div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" /></div>;
}
