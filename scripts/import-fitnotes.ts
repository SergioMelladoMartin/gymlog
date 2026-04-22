/**
 * Import a FitNotes .fitnotes (SQLite) backup into the gymlog libSQL database.
 *
 *   npx tsx scripts/import-fitnotes.ts "/path/to/Backup.fitnotes"
 *
 * Safe to re-run: uses INSERT OR REPLACE on categories/exercises and skips
 * duplicate sets by (exercise_id, date, position).
 */
import { createClient } from '@libsql/client';

const source = process.argv[2];
if (!source) {
  console.error('Usage: tsx scripts/import-fitnotes.ts <path-to-backup.fitnotes>');
  process.exit(1);
}

const target = process.env.TURSO_DATABASE_URL ?? 'file:data/gymlog.db';
const targetToken = process.env.TURSO_AUTH_TOKEN;

const src = createClient({ url: `file:${source}` });
const dst = createClient({ url: target, authToken: targetToken });

// Convert FitNotes' signed ARGB int to CSS hex.
function argbToHex(n: number | null): string | null {
  if (n == null) return null;
  const unsigned = n >>> 0;
  const r = (unsigned >> 16) & 0xff;
  const g = (unsigned >> 8) & 0xff;
  const b = unsigned & 0xff;
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

console.log(`Reading FitNotes backup: ${source}`);
console.log(`Writing to: ${target}`);

// --- Categories ---
const cats = await src.execute('SELECT _id, name, colour, sort_order FROM Category');
for (const row of cats.rows) {
  await dst.execute({
    sql: 'INSERT OR REPLACE INTO category (id, name, color, sort_order) VALUES (?, ?, ?, ?)',
    args: [
      row._id as number,
      row.name as string,
      argbToHex(row.colour as number | null),
      (row.sort_order as number) ?? 0,
    ],
  });
}
console.log(`  categories: ${cats.rows.length}`);

// --- Exercises ---
const exs = await src.execute(
  'SELECT _id, name, category_id, notes, is_favourite FROM exercise'
);
for (const row of exs.rows) {
  await dst.execute({
    sql: 'INSERT OR REPLACE INTO exercise (id, name, category_id, notes, is_favorite) VALUES (?, ?, ?, ?, ?)',
    args: [
      row._id as number,
      row.name as string,
      row.category_id as number,
      (row.notes as string | null) ?? null,
      (row.is_favourite as number) ?? 0,
    ],
  });
}
console.log(`  exercises:  ${exs.rows.length}`);

// --- Training log -> training_set ---
// Compute a deterministic position per (exercise, date) by _id order.
const logs = await src.execute(`
  SELECT _id, exercise_id, date, metric_weight, reps,
         distance, duration_seconds, is_personal_record
  FROM training_log
  ORDER BY date ASC, exercise_id ASC, _id ASC
`);

// Wipe and bulk-reinsert sets (idempotent, easier than diffing).
await dst.execute('DELETE FROM training_set');

const positions = new Map<string, number>();
const batch: Array<ReturnType<typeof buildInsert>> = [];
function buildInsert(args: (number | string | null)[]) {
  return {
    sql: `INSERT INTO training_set
          (exercise_id, date, weight_kg, reps, distance_m, duration_seconds, is_personal_record, position)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args,
  };
}

for (const row of logs.rows) {
  const key = `${row.exercise_id}|${row.date}`;
  const pos = (positions.get(key) ?? 0) + 1;
  positions.set(key, pos);
  batch.push(
    buildInsert([
      row.exercise_id as number,
      row.date as string,
      (row.metric_weight as number) ?? 0,
      (row.reps as number) ?? 0,
      (row.distance as number) ?? 0,
      (row.duration_seconds as number) ?? 0,
      (row.is_personal_record as number) ?? 0,
      pos,
    ])
  );
  if (batch.length >= 500) {
    await dst.batch(batch, 'write');
    batch.length = 0;
  }
}
if (batch.length) await dst.batch(batch, 'write');
console.log(`  sets:       ${logs.rows.length}`);

// --- Workout comments ---
await dst.execute('DELETE FROM workout_comment');
const comments = await src.execute('SELECT date, comment FROM WorkoutComment');
for (const row of comments.rows) {
  await dst.execute({
    sql: 'INSERT OR REPLACE INTO workout_comment (date, body) VALUES (?, ?)',
    args: [row.date as string, row.comment as string],
  });
}
console.log(`  comments:   ${comments.rows.length}`);

// --- Body weight ---
await dst.execute('DELETE FROM body_weight');
const bw = await src.execute('SELECT date, body_weight_metric FROM BodyWeight');
for (const row of bw.rows) {
  await dst.execute({
    sql: 'INSERT OR REPLACE INTO body_weight (date, weight_kg) VALUES (?, ?)',
    args: [row.date as string, row.body_weight_metric as number],
  });
}
console.log(`  bodyweight: ${bw.rows.length}`);

console.log('Done.');
