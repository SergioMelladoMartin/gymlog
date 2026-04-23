/**
 * One-shot dump of the current Turso DB into the local-first JSON schema.
 * Used once during the migration to the Google Drive–backed architecture:
 * the resulting file can be imported into the app, which then pushes it
 * to the user's Drive appdata folder.
 *
 *   npx tsx scripts/export-to-json.ts > data/export.json
 */
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL ?? 'file:data/gymlog.db';
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

const categories = (await db.execute('SELECT id, name, color, sort_order FROM category ORDER BY sort_order, id')).rows;

// Pick the first (and only) real user, or fall back to orphan rows.
const users = (await db.execute('SELECT id FROM user')).rows;
const ownerCondition = users.length
  ? { sql: 'user_id = ?', args: [users[0].id as string] }
  : { sql: 'user_id IS NULL OR user_id IS NOT NULL', args: [] };

const exercises = (
  await db.execute({
    sql: `SELECT id, name, category_id, notes, is_favorite FROM exercise WHERE ${ownerCondition.sql}`,
    args: ownerCondition.args,
  })
).rows;

const sets = (
  await db.execute({
    sql: `SELECT id, exercise_id, date, weight_kg, reps, distance_m, duration_seconds, position, is_personal_record, created_at
          FROM training_set WHERE ${ownerCondition.sql}`,
    args: ownerCondition.args,
  })
).rows;

const comments = (
  await db.execute({
    sql: `SELECT date, body FROM workout_comment WHERE ${ownerCondition.sql}`,
    args: ownerCondition.args,
  })
).rows;

const bodyWeight = (
  await db.execute({
    sql: `SELECT date, weight_kg FROM body_weight WHERE ${ownerCondition.sql}`,
    args: ownerCondition.args,
  })
).rows;

const out = {
  version: 1,
  updatedAt: new Date().toISOString(),
  categories: categories.map((c) => ({
    id: Number(c.id),
    name: String(c.name),
    color: c.color ? String(c.color) : null,
    sort_order: Number(c.sort_order),
  })),
  exercises: exercises.map((e) => ({
    id: Number(e.id),
    name: String(e.name),
    category_id: Number(e.category_id),
    notes: e.notes ? String(e.notes) : null,
    is_favorite: Number(e.is_favorite) === 1,
  })),
  sets: sets.map((s) => ({
    id: Number(s.id),
    exercise_id: Number(s.exercise_id),
    date: String(s.date),
    weight_kg: Number(s.weight_kg),
    reps: Number(s.reps),
    distance_m: Number(s.distance_m),
    duration_seconds: Number(s.duration_seconds),
    position: Number(s.position),
    created_at: s.created_at ? String(s.created_at) : null,
  })),
  comments: Object.fromEntries(comments.map((c) => [String(c.date), String(c.body)])),
  body_weight: bodyWeight.map((b) => ({
    date: String(b.date),
    weight_kg: Number(b.weight_kg),
  })),
};

process.stdout.write(JSON.stringify(out, null, 2));
process.stderr.write(
  `\nexported: ${out.categories.length} categories · ${out.exercises.length} exercises · ${out.sets.length} sets · ${Object.keys(out.comments).length} comments · ${out.body_weight.length} body_weight\n`,
);
