import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { getSetsForDate } from '../../../lib/queries';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const date = url.searchParams.get('date');
  if (!date) return new Response('date required', { status: 400 });
  const sets = await getSetsForDate(locals.user.id, date);
  return Response.json(sets);
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const userId = locals.user.id;
  const body = await request.json();
  const { exercise_id, date, weight_kg, reps, distance_m, duration_seconds } = body;

  if (!exercise_id || !date) {
    return new Response('exercise_id and date required', { status: 400 });
  }

  // Verify the exercise belongs to the user.
  const owns = await db.execute({
    sql: 'SELECT 1 FROM exercise WHERE id = ? AND user_id = ? LIMIT 1',
    args: [exercise_id, userId],
  });
  if (!owns.rows.length) return new Response('forbidden', { status: 403 });

  const posRes = await db.execute({
    sql: 'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM training_set WHERE exercise_id = ? AND date = ? AND user_id = ?',
    args: [exercise_id, date, userId],
  });
  const position = (posRes.rows[0]?.next_pos as number) ?? 1;

  const res = await db.execute({
    sql: `INSERT INTO training_set
          (user_id, exercise_id, date, weight_kg, reps, distance_m, duration_seconds, position)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id`,
    args: [userId, exercise_id, date, weight_kg ?? 0, reps ?? 0, distance_m ?? 0, duration_seconds ?? 0, position],
  });
  const id = res.rows[0]?.id as number;

  const holderRes = await db.execute({
    sql: `SELECT
      (SELECT id FROM training_set WHERE exercise_id = ? AND user_id = ?
       ORDER BY weight_kg DESC, id ASC LIMIT 1) AS pr_w_id,
      (SELECT id FROM training_set WHERE exercise_id = ? AND user_id = ?
       ORDER BY (weight_kg * (1.0 + reps / 30.0)) DESC, id ASC LIMIT 1) AS pr_1rm_id,
      (SELECT id FROM training_set WHERE exercise_id = ? AND user_id = ? AND weight_kg = ?
       ORDER BY reps DESC, id ASC LIMIT 1) AS pr_reps_id`,
    args: [exercise_id, userId, exercise_id, userId, exercise_id, userId, weight_kg ?? 0],
  });
  const h = holderRes.rows[0] as unknown as { pr_w_id: number; pr_1rm_id: number; pr_reps_id: number };
  const pr_weight = h.pr_w_id === id ? 1 : 0;
  const pr_1rm = h.pr_1rm_id === id ? 1 : 0;
  const pr_reps = h.pr_reps_id === id ? 1 : 0;

  return Response.json({ id, position, pr_weight, pr_1rm, pr_reps });
};
