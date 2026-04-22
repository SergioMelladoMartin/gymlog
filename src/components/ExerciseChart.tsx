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

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'est_1rm', label: '1RM estimado', unit: 'kg' },
  { id: 'top_weight', label: 'Top set', unit: 'kg' },
  { id: 'total_volume', label: 'Volumen', unit: 'kg' },
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

export default function ExerciseChart({ data }: { data: SessionPoint[] }) {
  const [metric, setMetric] = useState<Metric>('est_1rm');
  const [colors, setColors] = useState(readCssColors);

  useEffect(() => {
    setColors(readCssColors());
    const obs = new MutationObserver(() => setColors(readCssColors()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const active = METRICS.find((m) => m.id === metric)!;

  const chartData = useMemo(() => data.map((d) => ({
    date: d.date,
    value: Math.round(d[metric] * 10) / 10,
    top_set_weight: d.top_set_weight,
    top_set_reps: d.top_set_reps,
    rm_set_weight: d.rm_set_weight,
    rm_set_reps: d.rm_set_reps,
    set_count: d.set_count,
  })), [data, metric]);

  const maxPoint = useMemo(() => {
    if (!chartData.length) return null;
    let best = chartData[0];
    for (const p of chartData) if (p.value > best.value) best = p;
    return best;
  }, [chartData]);

  if (data.length === 0) {
    return <div className="text-sm text-muted">Sin histórico todavía.</div>;
  }

  return (
    <div>
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

      <div className="h-64 w-full">
        <ResponsiveContainer>
          <AreaChart data={chartData} margin={{ top: 12, right: 12, bottom: 0, left: -16 }}>
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
              cursor={{ stroke: colors.muted, strokeDasharray: '3 3' }}
              content={<CustomTooltip metric={metric} unit={active.unit} colors={colors} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={colors.accent}
              strokeWidth={2}
              fill="url(#fill)"
              activeDot={{ r: 4, stroke: colors.bg, strokeWidth: 2, fill: colors.accent }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  metric,
  unit,
  colors,
}: {
  active?: boolean;
  payload?: Array<{ payload: any }>;
  label?: string;
  metric: Metric;
  unit: string;
  colors: { card: string; grid: string; fg: string; muted: string };
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as {
    value: number;
    top_set_weight: number;
    top_set_reps: number;
    rm_set_weight: number;
    rm_set_reps: number;
    set_count: number;
  };

  const prettyDate = label
    ? new Date(label + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  let detail: string | null = null;
  if (metric === 'est_1rm') {
    detail = `serie: ${formatKg(p.rm_set_weight)} kg × ${p.rm_set_reps} reps`;
  } else if (metric === 'top_weight') {
    detail = `serie: ${formatKg(p.top_set_weight)} kg × ${p.top_set_reps} reps`;
  } else {
    detail = `${p.set_count} sets en el día`;
  }

  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.grid}`,
        borderRadius: 10,
        padding: '8px 10px',
        fontSize: 12,
        color: colors.fg,
        minWidth: 160,
        boxShadow: '0 8px 24px -12px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ color: colors.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
        {prettyDate}
      </div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>
        {formatKg(p.value)} <span style={{ color: colors.muted, fontSize: 11 }}>{unit}</span>
      </div>
      {detail && (
        <div style={{ marginTop: 2, color: colors.muted, fontSize: 11 }}>{detail}</div>
      )}
    </div>
  );
}
