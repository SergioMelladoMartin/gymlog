import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface TrendPoint {
  label: string;
  value: number;
}

function readCssColors() {
  if (typeof window === 'undefined') {
    return { accent: '#a3e635', grid: '#3a3a44', muted: '#7a7a86' };
  }
  const s = getComputedStyle(document.documentElement);
  return {
    accent: s.getPropertyValue('--color-accent').trim() || '#a3e635',
    grid: s.getPropertyValue('--color-border').trim() || '#3a3a44',
    muted: s.getPropertyValue('--color-muted').trim() || '#7a7a86',
  };
}

function compact(n: number): string {
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(Math.round(n));
}

export default function StatsTrendChart({
  data,
  unit,
}: {
  data: TrendPoint[];
  unit?: string;
}) {
  const colors = useMemo(readCssColors, []);

  if (!data.length) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
        Sin datos en este periodo.
      </div>
    );
  }

  return (
    <div className="h-56 w-full select-none">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.accent} stopOpacity={0.95} />
              <stop offset="100%" stopColor={colors.accent} stopOpacity={0.45} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: colors.muted, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={14}
            axisLine={{ stroke: colors.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: colors.muted, fontSize: 11 }}
            width={46}
            allowDecimals={false}
            tickFormatter={(v: number) => compact(v)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: colors.accent, fillOpacity: 0.08 }}
            content={(props: any) => {
              if (!props.active || !props.payload?.length) return null;
              const p = props.payload[0].payload as TrendPoint;
              return (
                <div className="pointer-events-none rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-[11px] shadow-md">
                  <div className="font-medium text-fg">{p.label}</div>
                  <div className="mt-0.5 tabular-nums">
                    <span className="text-base font-semibold tracking-tight">
                      {Math.round(p.value).toLocaleString('es-ES')}
                    </span>
                    {unit && <span className="ml-0.5 text-[10px] text-muted">{unit}</span>}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="value" fill="url(#barFill)" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={42} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
