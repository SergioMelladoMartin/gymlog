import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const fontsDir = new URL('../fonts/', import.meta.url);
const fontRegular = readFileSync(fileURLToPath(new URL('Inter-Regular.ttf', fontsDir)));
const fontSemiBold = readFileSync(fileURLToPath(new URL('Inter-SemiBold.ttf', fontsDir)));
const fontBold = readFileSync(fileURLToPath(new URL('Inter-Bold.ttf', fontsDir)));

export interface ShareExerciseGroup {
  name: string;
  category_color: string | null;
  sets: Array<{
    weight_kg: number;
    reps: number;
    pr_weight?: number;
    pr_1rm?: number;
    pr_reps?: number;
  }>;
}

export interface ShareCardData {
  dateLabel: string;     // e.g. "Lunes, 22 de abril"
  totalSets: number;
  totalExercises: number;
  totalVolume: number;   // kg
  best1RM?: { exercise: string; value: number };
  groups: ShareExerciseGroup[];
  comment?: string | null;
}

function fmt(n: number) {
  return Math.round(n * 10) / 10;
}

function formatKg(n: number) {
  const r = fmt(n);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export async function renderShareCardPng(d: ShareCardData): Promise<Buffer> {
  const width = 1080;
  const height = 1350; // 4:5 — IG / Stories friendly

  const markup = buildMarkup(d);

  const svg = await satori(markup, {
    width,
    height,
    fonts: [
      { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
      { name: 'Inter', data: fontSemiBold, weight: 600, style: 'normal' },
      { name: 'Inter', data: fontBold, weight: 700, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'rgba(0, 0, 0, 0)',
  });
  return Buffer.from(resvg.render().asPng());
}

function buildMarkup(d: ShareCardData) {
  const accent = '#a3e635';
  const ink = '#0a1400';
  const bg = '#0b0b0f';
  const card = '#17171d';
  const border = '#2a2a34';
  const muted = '#8a8a96';
  const fg = '#ededf1';

  // Summary of all sets across exercises for display.
  const exerciseCards = d.groups.slice(0, 8).map((g) => {
    const topSet = g.sets.reduce((best, s) => (s.weight_kg > best.weight_kg || (s.weight_kg === best.weight_kg && s.reps > best.reps) ? s : best), g.sets[0]);
    const anyPr = g.sets.some((s) => s.pr_weight || s.pr_1rm || s.pr_reps);
    return (
      <div
        key={g.name}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '16px 20px',
          background: card,
          border: `1px solid ${border}`,
          borderRadius: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, background: g.category_color ?? '#888' }} />
          <div style={{ fontSize: 24, fontWeight: 600, color: fg, flexShrink: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {g.name}
          </div>
          {anyPr && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: accent, color: ink, padding: '3px 8px', borderRadius: 6, fontSize: 14, fontWeight: 700 }}>
              PR
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {g.sets.slice(0, 8).map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                background: '#20202a',
                borderRadius: 8,
                fontSize: 18,
                fontWeight: 600,
                color: fg,
              }}
            >
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatKg(s.weight_kg)}</span>
              <span style={{ color: muted, fontSize: 14, fontWeight: 400 }}>kg</span>
              <span style={{ color: muted, margin: '0 4px' }}>×</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{s.reps}</span>
            </div>
          ))}
          {g.sets.length > 8 && (
            <div style={{ display: 'flex', alignItems: 'center', color: muted, fontSize: 14 }}>
              +{g.sets.length - 8} más
            </div>
          )}
        </div>
      </div>
    );
  });

  const moreExercises = d.groups.length - 8;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 60,
        fontFamily: 'Inter',
        color: fg,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{ display: 'flex', width: 48, height: 48, borderRadius: 12, background: accent, alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: ink }}>
          g
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>gymlog</div>
          <div style={{ fontSize: 16, color: muted, textTransform: 'capitalize' }}>{d.dateLabel}</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 30 }}>
        <Kpi label="Ejercicios" value={String(d.totalExercises)} accent={accent} ink={ink} muted={muted} card={card} border={border} />
        <Kpi label="Sets" value={String(d.totalSets)} accent={accent} ink={ink} muted={muted} card={card} border={border} />
        <Kpi label="Volumen" value={`${Math.round(d.totalVolume).toLocaleString('es-ES')} kg`} accent={accent} ink={ink} muted={muted} card={card} border={border} />
      </div>

      {d.best1RM && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', marginBottom: 24, background: `${accent}1f`, border: `1px solid ${accent}66`, borderRadius: 14 }}>
          <div style={{ display: 'flex', width: 40, height: 40, borderRadius: 999, background: accent, alignItems: 'center', justifyContent: 'center', fontSize: 22, color: ink, fontWeight: 700 }}>★</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 14, color: muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Top 1RM estimado</div>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: fg }}>
              {`${formatKg(d.best1RM.value)} kg — ${d.best1RM.exercise}`}
            </div>
          </div>
        </div>
      )}

      {/* Exercises */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {exerciseCards}
        {moreExercises > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontSize: 16, color: muted }}>
            {`+${moreExercises} ejercicio${moreExercises === 1 ? '' : 's'} más`}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTop: `1px solid ${border}`, marginTop: 24 }}>
        <div style={{ display: 'flex', color: muted, fontSize: 14 }}>Registrado en gymlog</div>
        <div style={{ display: 'flex', color: accent, fontSize: 16, fontWeight: 600 }}>{d.dateLabel.split(',')[0]}</div>
      </div>
    </div>
  );
}

function Kpi({ label, value, muted, card, border }: { label: string; value: string; accent: string; ink: string; muted: string; card: string; border: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, padding: '18px 22px', background: card, border: `1px solid ${border}`, borderRadius: 14 }}>
      <div style={{ display: 'flex', fontSize: 13, color: muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
