import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface SessionPoint {
  date: string;
  top_weight: number;
  est_1rm: number;
  total_volume: number;
  set_count: number;
  top_set_weight: number;
  top_set_reps: number;
  rm_set_weight: number;
  rm_set_reps: number;
}

type Metric = 'est_1rm' | 'top_weight' | 'total_volume';
type RangeId = '1Y' | 'YTD' | '3Y' | 'ALL';

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'est_1rm', label: '1RM est.', unit: 'kg' },
  { id: 'top_weight', label: 'Top set', unit: 'kg' },
  { id: 'total_volume', label: 'Volumen', unit: 'kg' },
];

const RANGES: { id: RangeId; label: string }[] = [
  { id: '1Y', label: '1A' },
  { id: 'YTD', label: 'YTD' },
  { id: '3Y', label: '3A' },
  { id: 'ALL', label: 'Todo' },
];

function readCssColors() {
  if (typeof window === 'undefined') {
    return { accent: '#a3e635', grid: '#2a2a34', muted: '#7a7a86', card: '#17171d', fg: '#ededf1', bg: '#0b0b0f' };
  }
  const s = getComputedStyle(document.documentElement);
  return {
    accent: s.getPropertyValue('--color-accent').trim() || '#a3e635',
    grid: s.getPropertyValue('--color-border').trim() || '#2a2a34',
    muted: s.getPropertyValue('--color-muted').trim() || '#7a7a86',
    card: s.getPropertyValue('--color-card').trim() || '#17171d',
    fg: s.getPropertyValue('--color-fg').trim() || '#ededf1',
    bg: s.getPropertyValue('--color-bg').trim() || '#0b0b0f',
  };
}

function formatKg(n: number) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function rangeCutoff(rangeId: RangeId, lastDateISO: string): string | null {
  if (rangeId === 'ALL') return null;
  const last = new Date(lastDateISO + 'T00:00:00');
  const cutoff = new Date(last);
  if (rangeId === 'YTD') {
    cutoff.setMonth(0, 1);
  } else if (rangeId === '1Y') {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
  } else if (rangeId === '3Y') {
    cutoff.setFullYear(cutoff.getFullYear() - 3);
  }
  const y = cutoff.getFullYear();
  const m = String(cutoff.getMonth() + 1).padStart(2, '0');
  const d = String(cutoff.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function ExerciseChart({ data }: { data: SessionPoint[] }) {
  const [metric, setMetric] = useState<Metric>('est_1rm');
  const [range, setRange] = useState<RangeId>('1Y');
  const [colors, setColors] = useState(readCssColors);
  // Index of the data point currently under the user's finger / cursor.
  // Powers the "scrubbing" banner above the chart.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    setColors(readCssColors());
    const obs = new MutationObserver(() => setColors(readCssColors()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const active = METRICS.find((m) => m.id === metric)!;

  // Filter by range first, then by metric. The metric switch only changes the
  // y-value, range trims the visible window.
  const filtered = useMemo(() => {
    if (data.length === 0) return data;
    const cutoff = rangeCutoff(range, data[data.length - 1].date);
    if (!cutoff) return data;
    return data.filter((d) => d.date >= cutoff);
  }, [data, range]);

  const chartData = useMemo(() => filtered.map((d) => ({
    date: d.date,
    value: Math.round(d[metric] * 10) / 10,
    top_set_weight: d.top_set_weight,
    top_set_reps: d.top_set_reps,
    rm_set_weight: d.rm_set_weight,
    rm_set_reps: d.rm_set_reps,
    set_count: d.set_count,
  })), [filtered, metric]);

  const maxPoint = useMemo(() => {
    if (!chartData.length) return null;
    let best = chartData[0];
    for (const p of chartData) if (p.value > best.value) best = p;
    return best;
  }, [chartData]);

  // Whatever point the finger/cursor is over — falls back to the latest point
  // when nothing is hovered, so the banner is never empty.
  const focusPoint = useMemo(() => {
    if (chartData.length === 0) return null;
    if (hoverIdx != null && chartData[hoverIdx]) return chartData[hoverIdx];
    return chartData[chartData.length - 1];
  }, [chartData, hoverIdx]);

  if (data.length === 0) {
    return <div className="text-sm text-muted">Sin histórico todavía.</div>;
  }

  const handleMove = (state: any) => {
    const idx = state?.activeTooltipIndex;
    if (typeof idx === 'number' && idx >= 0) setHoverIdx(idx);
  };
  const handleLeave = () => setHoverIdx(null);

  return (
    <div>
      {/* Scrubbing banner — what's under your finger right now. */}
      {focusPoint && <ScrubBanner point={focusPoint} metric={metric} unit={active.unit} colors={colors} live={hoverIdx != null} />}

      {/* Range chips */}
      <div className="no-scrollbar mb-2 -mx-1 flex gap-1 overflow-x-auto px-1">
        {RANGES.map((r) => {
          const isActive = range === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                isActive
                  ? 'bg-fg/90 text-bg'
                  : 'border border-border bg-card text-muted hover:text-fg'
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Metric chips */}
      <div className="mb-3 flex gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMetric(m.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              metric === m.id
                ? 'bg-accent text-ink'
                : 'bg-elevated text-muted hover:text-fg'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
          Sin sesiones en este rango.
        </div>
      ) : (
        <div
          className="h-64 w-full select-none touch-none"
          // touch-none keeps the page from vertically scrolling while the
          // user scrubs the chart with a finger.
        >
          <ResponsiveContainer>
            <AreaChart
              data={chartData}
              margin={{ top: 12, right: 12, bottom: 0, left: -16 }}
              onMouseMove={handleMove}
              onMouseLeave={handleLeave}
              onTouchMove={handleMove as any}
              onTouchEnd={handleLeave}
            >
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.accent} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: colors.muted, fontSize: 11 }}
                tickFormatter={(v: string) => {
                  const d = new Date(v + 'T00:00:00');
                  const m = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
                  return `${m} ${String(d.getFullYear()).slice(2)}`;
                }}
                minTickGap={40}
                axisLine={{ stroke: colors.grid }}
                tickLine={{ stroke: colors.grid }}
              />
              <YAxis
                tick={{ fill: colors.muted, fontSize: 11 }}
                width={42}
                domain={['auto', 'auto']}
                axisLine={false}
                tickLine={false}
              />
              {maxPoint && (
                <ReferenceLine
                  y={maxPoint.value}
                  stroke={colors.accent}
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  strokeWidth={1}
                  label={{
                    value: `máx ${formatKg(maxPoint.value)} ${active.unit}`,
                    position: 'insideTopRight',
                    fill: colors.accent,
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
              )}
              <Tooltip
                cursor={{ stroke: colors.accent, strokeOpacity: 0.6, strokeWidth: 1 }}
                content={() => null}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={colors.accent}
                strokeWidth={2}
                fill="url(#fill)"
                isAnimationActive={false}
                activeDot={{ r: 5, stroke: colors.bg, strokeWidth: 2, fill: colors.accent }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ScrubBanner({
  point,
  metric,
  unit,
  colors,
  live,
}: {
  point: {
    date: string;
    value: number;
    top_set_weight: number;
    top_set_reps: number;
    rm_set_weight: number;
    rm_set_reps: number;
    set_count: number;
  };
  metric: Metric;
  unit: string;
  colors: { fg: string; muted: string };
  live: boolean;
}) {
  const prettyDate = new Date(point.date + 'T00:00:00')
    .toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  let detail: string;
  if (metric === 'est_1rm') {
    detail = `${formatKg(point.rm_set_weight)} kg × ${point.rm_set_reps} reps`;
  } else if (metric === 'top_weight') {
    detail = `${formatKg(point.top_set_weight)} kg × ${point.top_set_reps} reps`;
  } else {
    detail = `${point.set_count} ${point.set_count === 1 ? 'serie' : 'series'} en el día`;
  }

  return (
    <div className="mb-2 flex items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2">
      <div className="min-w-0">
        <div
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: colors.muted }}
        >
          {prettyDate}{live ? '' : ' · último'}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">{detail}</div>
      </div>
      <div className="text-right">
        <span className="text-xl font-semibold tabular-nums tracking-tight">
          {formatKg(point.value)}
        </span>
        <span className="ml-1 text-xs text-muted">{unit}</span>
      </div>
    </div>
  );
}
