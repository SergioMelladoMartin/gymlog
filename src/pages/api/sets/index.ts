import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { getSetsForDate } from '../../../lib/queries';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const date = url.searchParams.get('date');
  if (!date) return new Response('date required', { status: 400 });
  const sets = await getSetsForDate(date);
  return Response.json(sets);
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { exercise_id, date, weight_kg, reps, distance_m, duration_seconds } = body;

  if (!exercise_id || !date) {
    return new Response('exercise_id and date required', { status: 400 });
  }

  const posRes = await db.execute({
    sql: 'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM training_set WHERE exercise_id = ? AND date = ?',
    args: [exercise_id, date],
  });
  const position = (posRes.rows[0]?.next_pos as number) ?? 1;

  const res = await db.execute({
    sql: `INSERT INTO training_set
          (exercise_id, date, weight_kg, reps, distance_m, duration_seconds, position)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING id`,
    args: [
      exercise_id,
      date,
      weight_kg ?? 0,
      reps ?? 0,
      distance_m ?? 0,
      duration_seconds ?? 0,
      position,
    ],
  });
  const id = res.rows[0]?.id as number;

  // Is this new set the current holder of any PR? Tiebreak: earliest id.
  const holderRes = await db.execute({
    sql: `
      SELECT
        (SELECT id FROM training_set WHERE exercise_id = ?
         ORDER BY weight_kg DESC, id ASC LIMIT 1) AS pr_w_id,
        (SELECT id FROM training_set WHERE exercise_id = ?
         ORDER BY (weight_kg * (1.0 + reps / 30.0)) DESC, id ASC LIMIT 1) AS pr_1rm_id,
        (SELECT id FROM training_set WHERE exercise_id = ? AND weight_kg = ?
         ORDER BY reps DESC, id ASC LIMIT 1) AS pr_reps_id
    `,
    args: [exercise_id, exercise_id, exercise_id, weight_kg ?? 0],
  });
  const h = holderRes.rows[0] as unknown as { pr_w_id: number; pr_1rm_id: number; pr_reps_id: number };
  const pr_weight = h.pr_w_id === id ? 1 : 0;
  const pr_1rm = h.pr_1rm_id === id ? 1 : 0;
  const pr_reps = h.pr_reps_id === id ? 1 : 0;

  return Response.json({ id, position, pr_weight, pr_1rm, pr_reps });
};
