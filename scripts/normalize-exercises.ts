/**
 * Interactive-safe mass rename of exercise names into a normalized format:
 *   "<Nombre> (<implemento>)" where implemento is one of
 *   barra | mancuernas | multipower | polea | máquina | máquina discos | máquina placas | cuerda | libre
 *
 * Run with:  npx tsx scripts/normalize-exercises.ts          (dry-run, prints the plan)
 *            npx tsx scripts/normalize-exercises.ts --apply  (writes to the DB)
 *
 * Edits are applied in a single transaction. The script is idempotent — running
 * it twice with the same mapping is a no-op after the first pass.
 */
import { createClient } from '@libsql/client';

const RENAMES: Record<string, string> = {
  // ─── Pecho ────────────────────────────────────────────────────
  'Contracción Pecho Inclinado': 'Contracción Pecho Inclinado (máquina)',
  'Cruce Poleas Bajas': 'Cruce Poleas Bajas (polea)',
  'Cruce de Poleas Altas': 'Cruce Poleas Altas (polea)',
  'Flexiones': 'Flexiones',
  'Máquina Contracción Pecho': 'Contracción Pecho (máquina)',
  'Máquina Contracción Pecho Abierta': 'Contracción Pecho Abierta (máquina)',
  'Press Banca Máquina Discos': 'Press Banca Plano (máquina discos)',
  'Press Banca Plano': 'Press Banca Plano (barra)',
  'Press Banca Plano (multipower)': 'Press Banca Plano (multipower)',
  'Press Banca Plano Máquina Discos': 'Press Banca Plano (máquina discos)',
  'Press Inclinado (multipower)': 'Press Inclinado (multipower)',
  'Press Inclinado con Mancuernas 30°': 'Press Inclinado 30° (mancuernas)',
  'Press Inclunado con Mancuernas 45°': 'Press Inclinado 45° (mancuernas)',
  'Press Máquina (discos)': 'Press Pecho (máquina discos)',
  'Press Máquina Alta (discos)': 'Press Pecho Alto (máquina discos)',
  'Press Máquina Baja (discos)': 'Press Pecho Bajo (máquina discos)',
  'Pull Over': 'Pull Over (polea)',
  'Triple empuje maquina discos': 'Triple Empuje (máquina discos)',

  // ─── Tríceps ──────────────────────────────────────────────────
  'Fondos Barra (Una)': 'Fondos en Paralelas',
  'Fondos Máquina': 'Fondos (máquina)',
  'Fondos Máquina Discos': 'Fondos (máquina discos)',
  'Máquina Cuerdas': 'Tríceps (máquina cuerdas)',
  'Press Banca Agarra Tríceps': 'Press Banca Cerrado (barra)',
  'Press Banca Triceps Mancuernas': 'Press Banca Cerrado (mancuernas)',
  'Press Barra Tríceps': 'Press Francés (barra)',
  'Press Francés': 'Press Francés (mancuernas)',
  'Tríceps Máquina (placas)': 'Extensión Tríceps (máquina placas)',
  'Tríceps Polea (agarre normal)': 'Tríceps Polea (barra recta)',
  'Tríceps Polea (cuerda)': 'Tríceps Polea (cuerda)',
  'Tríceps Polea (unilateral)': 'Tríceps Polea Unilateral',
  'Tríceps Polea Baja': 'Tríceps Polea Baja',

  // ─── Hombro ───────────────────────────────────────────────────
  'Apertura Hombro Delts Machine': 'Pájaros (máquina)',
  'Apertura Hombro Mancuerna': 'Elevación Lateral (mancuernas)',
  'Apertura Hombro Máquina': 'Elevación Lateral (máquina)',
  'Apertura Hombro en Polea (unilateral)': 'Elevación Lateral Unilateral (polea)',
  'Apertura Hombros Bajo (mancuernas)': 'Pájaros (mancuernas)',
  'Elevaciones laterales máquina discos': 'Elevación Lateral (máquina discos)',
  'Face Pull': 'Face Pull (polea)',
  'Lateral Raise Máquina': 'Elevación Lateral (máquina placas)',
  'Press Arnold': 'Press Arnold (mancuernas)',
  'Press Hombro Máquina': 'Press Hombro (máquina)',
  'Press Militar (mancuernas)': 'Press Militar (mancuernas)',
  'Press Militar (multipower)': 'Press Militar (multipower)',
  'Press Militar Barra': 'Press Militar (barra)',
  'Press Militar Máquina (discos)': 'Press Militar (máquina discos)',
  'Press Militar Máquina (placas)': 'Press Militar (máquina placas)',

  // ─── Cardio ───────────────────────────────────────────────────
  'Basket': 'Basket',
  'Bici': 'Bici',
  'Caminar': 'Caminar',
  'Cinta': 'Cinta',
  'Correr': 'Correr',
  'Entreno Pesos Libres': 'Entreno Pesos Libres',
  'Escalera': 'Escalera',
  'Natación': 'Natación',
  'Remo Cardio': 'Remo (cardio)',

  // ─── Pierna ───────────────────────────────────────────────────
  'Abductor Máquina': 'Abductores (máquina)',
  'Apertura Glúteo Máquina Placas': 'Glúteo Patada (máquina placas)',
  'Empujar Carretilla': 'Empujar Carretilla',
  'Extensión Cuadriceps': 'Extensión Cuádriceps (máquina)',
  'Extensión Cuádriceps Unilateral': 'Extensión Cuádriceps Unilateral (máquina)',
  'Femoral Acostado Unilateral': 'Femoral Tumbado Unilateral (máquina)',
  'Femoral Máquina (sentado)': 'Femoral Sentado (máquina)',
  'Femoral Máquina (tumbado)': 'Femoral Tumbado (máquina)',
  'Femoral Máquina de Pie': 'Femoral de Pie (máquina)',
  'Gemelos Máquina (discos)': 'Gemelos (máquina discos)',
  'Gemelos en Prensa (placas)': 'Gemelos en Prensa (placas)',
  'Hack Squat': 'Hack Squat (máquina discos)',
  'Hip Trust (máquina discos)': 'Hip Thrust (máquina discos)',
  'Jaca Baja': 'Prensa Jaca (máquina discos)',
  'Máquina Levantamiento Gemelo': 'Gemelos de Pie (máquina)',
  'Peso Muerto': 'Peso Muerto (barra)',
  'Peso Muerto Rumano Máquina Discos': 'Peso Muerto Rumano (máquina discos)',
  'Prensa (discos)': 'Prensa (máquina discos)',
  'Prensa (placas)': 'Prensa (máquina placas)',
  'Prensa Linear': 'Prensa Lineal (máquina)',
  'Prensa Linear (unilateral)': 'Prensa Lineal Unilateral (máquina)',
  'Prensa Linear Femoral': 'Prensa Lineal Femoral (máquina)',
  'Rear Kick': 'Patada Glúteo (máquina)',
  'Sentadilla Búlgara (Mancuerna)': 'Sentadilla Búlgara (mancuernas)',
  'Sentadilla Libre': 'Sentadilla (barra)',
  'Sentadilla Máquina Guiada Discos': 'Sentadilla Guiada (máquina discos)',
  'Sentadilla Máquina Inclinada Discos': 'Sentadilla Inclinada (máquina discos)',
  'Zancadas': 'Zancadas (mancuernas)',

  // ─── Espalda ──────────────────────────────────────────────────
  'Apertura de Hombros Espalda': 'Pájaros (máquina)',
  'Dominadas Cinta': 'Dominadas Asistidas (banda)',
  'Dominadas Máquina Placas': 'Dominadas Asistidas (máquina placas)',
  'Dorsales Máquina (discos)': 'Pulldown Dorsales (máquina discos)',
  'Dorsales Máquina (placas)': 'Pulldown Dorsales (máquina placas)',
  'Dorsales Máquina Alta Discos': 'Pulldown Dorsales Alto (máquina discos)',
  'Dorsales Máquina Baja Discos': 'Pulldown Dorsales Bajo (máquina discos)',
  'Dorsales Polea': 'Pulldown Dorsales (polea)',
  'Jalon Polea Maquina baja': 'Jalón Polea Baja',
  'Jalon al Pecho (abierto)': 'Jalón al Pecho Agarre Abierto (polea)',
  'Jalon al Pecho (cerrado)': 'Jalón al Pecho Agarre Cerrado (polea)',
  'Jalón Carrito 10 metros': 'Arrastre de Trineo 10m',
  'Jalón Lateral Maquina Placas': 'Jalón Lateral (máquina placas)',
  'Jalón al Pecho (agarre bíceps)': 'Jalón al Pecho Agarre Supino (polea)',
  'Remo Bajo en Máquina (discos)': 'Remo Bajo (máquina discos)',
  'Remo Mancuernas Unilateral': 'Remo Unilateral (mancuerna)',
  'Remo Máquina (discos)': 'Remo (máquina discos)',
  'Remo Máquina Discos agarre abierto': 'Remo Agarre Abierto (máquina discos)',
  'Remo Máquina Placas': 'Remo (máquina placas)',
  'Remo Polea Abierto Agarre Prono': 'Remo Polea Agarre Prono',
  'Remo Seal (mancuernas)': 'Remo Seal (mancuernas)',
  'Remo Seal (máquina)': 'Remo Seal (máquina)',
  'Remo con Barra (multipower)': 'Remo con Barra (multipower)',
  'Remo en Barra Libre': 'Remo con Barra (libre)',
  'Remo en Polea (agarre abierto)': 'Remo Polea (agarre abierto)',
  'Remo en Polea (agarre cerrado)': 'Remo Polea (agarre cerrado)',
  'Remo en Polea (rastrillo)': 'Remo Polea (rastrillo)',
  'Remo en Polea Unilateral': 'Remo Polea Unilateral',
  'Seated Row Máquina': 'Remo Sentado (máquina)',
  'Trapecios Mancuernas': 'Encogimientos Trapecio (mancuernas)',
  'Trapecios Multipower': 'Encogimientos Trapecio (multipower)',

  // ─── Bíceps ───────────────────────────────────────────────────
  'Curl Bíceps (barra)': 'Curl Bíceps (barra)',
  'Curl Bíceps Maquina Placas Unilateral': 'Curl Bíceps Unilateral (máquina placas)',
  'Curl Bíceps Polea': 'Curl Bíceps (polea)',
  'Curl Martillo Polea Unilateral': 'Curl Martillo Unilateral (polea)',
  'Curl Polea Unilateral': 'Curl Bíceps Unilateral (polea)',
  'Curl Predicador (barra)': 'Curl Predicador (barra)',
  'Curl Predicador (máquina)': 'Curl Predicador (máquina)',
  'Curl Predicador Máquina Placas': 'Curl Predicador (máquina placas)',
  'Curl Predicador Plano Placas': 'Curl Predicador Plano (máquina placas)',
  'Curl de Bíceps (mancuernas)': 'Curl Bíceps (mancuernas)',
  'Curl de Bíceps en Máquina (placas)': 'Curl Bíceps (máquina placas)',
  'Curl en Polea (cuerda)': 'Curl Bíceps (polea, cuerda)',

  // ─── Core ─────────────────────────────────────────────────────
  'Abdominales Máquina': 'Abdominales (máquina)',
  'Lumbares Máquina': 'Lumbares (máquina)',

  // ─── Antebrazo ────────────────────────────────────────────────
  'Antebrazo en Polea': 'Curl Antebrazo (polea)',
  'Curl barra': 'Curl Antebrazo (barra)',
  'Curl de Antebrazo (máquina)': 'Curl Antebrazo (máquina)',
  'Curl mancuerna': 'Curl Antebrazo (mancuerna)',
  'Giros con mancuerna': 'Giros de Muñeca (mancuerna)',
};

const apply = process.argv.includes('--apply');

const url = process.env.TURSO_DATABASE_URL ?? 'file:data/gymlog.db';
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const res = await db.execute('SELECT id, name FROM exercise ORDER BY id');
const current = new Map<number, string>();
for (const row of res.rows) current.set(row.id as number, row.name as string);

type Plan = { id: number; from: string; to: string; conflict?: string };
const plan: Plan[] = [];
const skipped: string[] = [];

const targetCounts = new Map<string, number>();
for (const target of Object.values(RENAMES)) {
  targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1);
}

for (const [id, name] of current) {
  const target = RENAMES[name];
  if (!target) {
    skipped.push(name);
    continue;
  }
  if (target === name) continue;
  plan.push({ id, from: name, to: target });
}

// Detect target collisions (two originals normalize to the same name).
const targets = plan.map((p) => p.to);
const dup = targets.filter((t, i) => targets.indexOf(t) !== i);

console.log(`\nExercises in DB: ${current.size}`);
console.log(`Plan size:        ${plan.length}`);
console.log(`Skipped (not in mapping): ${skipped.length}`);
if (skipped.length) console.log('  ' + skipped.join('\n  '));

if (dup.length) {
  console.log('\n⚠️  Name collisions — multiple sources map to the same target:');
  for (const t of new Set(dup)) {
    const sources = plan.filter((p) => p.to === t).map((p) => `#${p.id} "${p.from}"`);
    console.log(`  ${t}:`);
    for (const s of sources) console.log(`    ← ${s}`);
  }
}

console.log('\nRenames:');
for (const p of plan) {
  console.log(`  #${p.id}  ${p.from}  →  ${p.to}`);
}

if (!apply) {
  console.log('\n(dry-run) Re-run with --apply to write to the database.');
  process.exit(0);
}

// Apply: for collisions, prefer the existing exercise with more sets.
const writes: Array<{ sql: string; args: (string | number)[] }> = [];
const collidingTargets = new Set(dup);
const handledCollisions = new Set<string>();

for (const p of plan) {
  if (!collidingTargets.has(p.to)) {
    writes.push({ sql: 'UPDATE exercise SET name = ? WHERE id = ?', args: [p.to, p.id] });
    continue;
  }
  if (handledCollisions.has(p.to)) continue;
  handledCollisions.add(p.to);

  const sources = plan.filter((x) => x.to === p.to);
  const counts = await Promise.all(sources.map(async (s) => {
    const r = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM training_set WHERE exercise_id = ?', args: [s.id] });
    return { id: s.id, count: Number(r.rows[0]?.c) || 0 };
  }));
  counts.sort((a, b) => b.count - a.count);
  const keep = counts[0].id;
  const merge = counts.slice(1).map((c) => c.id);
  console.log(`Merging into #${keep} (keeps name "${p.to}"): dropping ${merge.map((m) => `#${m}`).join(', ')}`);
  writes.push({ sql: 'UPDATE exercise SET name = ? WHERE id = ?', args: [p.to, keep] });
  for (const m of merge) {
    writes.push({ sql: 'UPDATE training_set SET exercise_id = ? WHERE exercise_id = ?', args: [keep, m] });
    writes.push({ sql: 'DELETE FROM exercise WHERE id = ?', args: [m] });
  }
}

await db.batch(writes, 'write');
console.log(`\n✅ Applied ${writes.length} statements.`);
