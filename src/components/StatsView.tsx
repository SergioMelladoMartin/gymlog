import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { useLocale } from '../hooks/useLocale';
import { getDb } from '../lib/sqlite';
import EmptyState from './EmptyState';
import { ChartSkeleton, StatsSkeleton } from './Skeleton';

const StatsTrendChart = lazy(() => import('./StatsTrendChart'));

type Range = 'all' | '7d' | '30d' | '90d' | '365d' | 'year';
type GroupBy = 'week' | 'month';
type TrendMetric = 'workouts' | 'volume' | 'sets' | 'reps';

interface TrendRow { period: string; days: number; sets: number; reps: number; volume: number }

function argbToHex(n: number | null): string | null {
  if (n == null) return null;
  const u = n >>> 0;
  return '#' + [(u >> 16) & 0xff, (u >> 8) & 0xff, u & 0xff].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function rangeLabel(range: Range, year: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  switch (range) {
    case '7d': return t('stats.range7d');
    case '30d': return t('stats.range30d');
    case '90d': return t('stats.range90d');
    case '365d': return t('stats.range365d');
    case 'year':
      return year === new Date().getFullYear()
        ? t('stats.rangeYear')
        : t('stats.rangeYearNamed', { year });
    default: return t('stats.rangeAll');
  }
}

export default function StatsView() {
  const ready = useDatabase();
  const { t, fmt, fmtDate, weekdaysLong, weekdaysNarrow } = useLocale();
  const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
  const range = (url?.searchParams.get('range') ?? 'all') as Range;
  const year = Number(url?.searchParams.get('year') ?? new Date().getFullYear());

  const [totals, setTotals] = useState({ total_sets: 0, total_days: 0, total_exercises: 0, total_volume: 0 });
  const [perCat, setPerCat] = useState<Array<{ id: number; name: string; color: string | null; set_count: number; volume: number }>>([]);
  const [top, setTop] = useState<Array<{ id: number; name: string; color: string | null; set_count: number }>>([]);
  const [weekday, setWeekday] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [groupBy, setGroupBy] = useState<GroupBy>('week');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('workouts');
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const trendLimit = groupBy === 'week' ? 54 : 12;

  const trendMetrics = useMemo(() => ([
    { id: 'workouts' as const, label: t('stats.metricWorkouts'), field: 'days' as const, unit: undefined },
    { id: 'volume' as const, label: t('stats.metricVolume'), field: 'volume' as const, unit: t('common.kg') },
    { id: 'sets' as const, label: t('stats.metricSets'), field: 'sets' as const, unit: undefined },
    { id: 'reps' as const, label: t('stats.metricReps'), field: 'reps' as const, unit: undefined },
  ]), [t]);

  useEffect(() => {
    if (!ready) return;
    const db = getDb();
    const q = (sql: string, params: any[] = []) =>
      db.exec({ sql, bind: params, rowMode: 'object', returnValue: 'resultRows' }) as any[];

    let pred = ''; let args: any[] = [];
    switch (range) {
      case '7d':   pred = "DATECOL >= date('now', '-7 days')"; break;
      case '30d':  pred = "DATECOL >= date('now', '-30 days')"; break;
      case '90d':  pred = "DATECOL >= date('now', '-90 days')"; break;
      case '365d': pred = "DATECOL >= date('now', '-365 days')"; break;
      case 'year':
        pred = 'DATECOL >= ? AND DATECOL <= ?';
        args = [`${year}-01-01`, `${year}-12-31`];
        break;
    }
    const where = pred ? `WHERE ${pred.replace(/DATECOL/g, 'date')}` : '';
    const whereTs = pred ? `WHERE ${pred.replace(/DATECOL/g, 'ts.date')}` : '';

    const row = q(
      `SELECT COUNT(*) AS total_sets, COUNT(DISTINCT date) AS total_days,
              COUNT(DISTINCT exercise_id) AS total_exercises,
              SUM(metric_weight * reps) AS total_volume
       FROM training_log ${where}`,
      args,
    )[0];
    setTotals({
      total_sets: Number(row?.total_sets ?? 0),
      total_days: Number(row?.total_days ?? 0),
      total_exercises: Number(row?.total_exercises ?? 0),
      total_volume: Number(row?.total_volume ?? 0),
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

  useEffect(() => {
    if (!ready) return;
    const db = getDb();
    const q = (sql: string) =>
      db.exec({ sql, rowMode: 'object', returnValue: 'resultRows' }) as any[];

    const periodExpr = groupBy === 'week'
      ? "date(date, '-' || ((strftime('%w', date) + 6) % 7) || ' days')"
      : "strftime('%Y-%m', date)";
    const rowsT = q(
      `SELECT ${periodExpr} AS period,
              COUNT(DISTINCT date) AS days,
              COUNT(*)             AS sets,
              SUM(reps)            AS reps,
              SUM(metric_weight * reps) AS volume
       FROM training_log
       GROUP BY period
       ORDER BY period DESC
       LIMIT ${trendLimit}`,
    );
    setTrend(
      rowsT.reverse().map((r: any) => ({
        period: String(r.period),
        days: Number(r.days ?? 0),
        sets: Number(r.sets ?? 0),
        reps: Number(r.reps ?? 0),
        volume: Number(r.volume ?? 0),
      })),
    );
  }, [ready, groupBy, trendLimit]);

  if (!ready) return <StatsSkeleton />;

  const label = rangeLabel(range, year, t);
  const maxVolume = perCat.reduce((a, c) => Math.max(a, c.volume), 0);
  const weekdayMax = Math.max(1, ...weekday);
  const currentYear = new Date().getFullYear();
  const chips: Array<{ id: Range; label: string; href: string; match: boolean }> = [
    { id: '7d', label: t('stats.chip7d'), href: '/stats?range=7d', match: range === '7d' },
    { id: '30d', label: t('stats.chip30d'), href: '/stats?range=30d', match: range === '30d' },
    { id: '90d', label: t('stats.chip90d'), href: '/stats?range=90d', match: range === '90d' },
    { id: '365d', label: t('stats.chip1y'), href: '/stats?range=365d', match: range === '365d' },
    { id: 'year', label: t('stats.chipYtd'), href: `/stats?range=year&year=${currentYear}`, match: range === 'year' && year === currentYear },
    { id: 'all', label: t('stats.chipAll'), href: '/stats', match: range === 'all' },
  ];

  const activeTrend = trendMetrics.find((m) => m.id === trendMetric)!;
  const trendData = trend.map((r) => ({
    label: groupBy === 'week'
      ? fmtDate(r.period, { day: 'numeric', month: 'short' })
      : fmtDate(r.period + '-01', { month: 'short', year: '2-digit' }),
    value: Number(r[activeTrend.field]),
  }));

  const weekdayLong = weekdaysLong();
  const weekdayShort = weekdaysNarrow();
  const hasAnyData = totals.total_sets > 0;

  return (
    <>
      <div className="mb-5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted">{t('stats.subtitle')}</div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('stats.title')}</h1>
      </div>

      {!hasAnyData && (
        <div className="mb-6">
          <EmptyState variant="stats" />
        </div>
      )}

      <div className="card mb-6 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="section-title">
            {t('stats.evolution', {
              period: groupBy === 'week'
                ? t('stats.weeks', { n: trendLimit })
                : t('stats.months', { n: trendLimit }),
            })}
          </div>
          <div className="flex gap-1 rounded-full border border-border bg-card p-0.5 text-[11px] font-medium">
            {(['week', 'month'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                className={`rounded-full px-3 py-1 transition ${groupBy === g ? 'btn-accent' : 'text-muted hover:text-fg'}`}
              >
                {g === 'week' ? t('stats.week') : t('stats.month')}
              </button>
            ))}
          </div>
        </div>

        <div className="no-scrollbar mb-3 -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {trendMetrics.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setTrendMetric(m.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition ${trendMetric === m.id ? 'btn-accent' : 'bg-elevated/50 text-muted hover:bg-elevated hover:text-fg'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <Suspense fallback={<ChartSkeleton />}>
          <StatsTrendChart data={trendData} unit={activeTrend.unit} />
        </Suspense>
      </div>

      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="section-title">{t('stats.periodSummary')}</div>
        <div className="text-xs capitalize text-muted">{label}</div>
      </div>

      <div className="no-scrollbar mb-4 -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {chips.map((c) => (
          <a key={c.id} href={c.href} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${c.match ? 'btn-accent' : 'border border-border bg-elevated/50 text-muted hover:bg-elevated hover:text-fg'}`}>{c.label}</a>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label={t('profile.days')} value={String(totals.total_days)} />
        <Tile label={t('workout.sets')} value={fmt(totals.total_sets)} />
        <Tile label={t('profile.exercises')} value={String(totals.total_exercises)} />
        <Tile label={t('profile.volume')} value={`${Math.round(totals.total_volume / 1000)}k`} unit={t('common.kg')} />
      </div>

      <div className="card mb-5 p-4">
        <div className="section-title mb-3">{t('stats.weeklyDistribution')}</div>
        <ul className="flex flex-col gap-2 sm:hidden">
          {weekdayLong.map((l, i) => {
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
          {weekdayShort.map((l, i) => {
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
        <div className="section-title mb-3">{t('stats.volumeByCategory')}</div>
        {perCat.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted">{t('common.noData')}</div>
        ) : (
          <ul className="flex flex-col gap-3">
            {perCat.map((c) => (
              <li key={c.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color ?? '#888' }} />
                    <span className="font-medium">{c.name}</span>
                  </span>
                  <span className="tabular-nums text-muted">
                    {t('stats.categoryVolume', { vol: fmt(c.volume), sets: c.set_count })}
                  </span>
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
        <div className="section-title mb-2">{t('stats.topExercises')}</div>
        {top.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted">{t('common.noData')}</div>
        ) : (
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
