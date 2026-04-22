import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { invalidateExercisesCache } from '../../../lib/queries';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const id = Number(params.id);
  if (!id) return new Response('id required', { status: 400 });

  const body = await request.json();
  const fields: string[] = [];
  const args: (number | string)[] = [];
  for (const key of ['weight_kg', 'reps', 'distance_m', 'duration_seconds', 'is_personal_record']) {
    if (key in body) {
      fields.push(`${key} = ?`);
      args.push(body[key]);
    }
  }
  if (!fields.length) return new Response('no fields', { status: 400 });
  args.push(id, locals.user.id);

  const res = await db.execute({
    sql: `UPDATE training_set SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    args,
  });
  if (!res.rowsAffected) return new Response('not found', { status: 404 });
  invalidateExercisesCache(locals.user.id);
  return new Response(null, { status: 204 });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const id = Number(params.id);
  if (!id) return new Response('id required', { status: 400 });
  const res = await db.execute({
    sql: 'DELETE FROM training_set WHERE id = ? AND user_id = ?',
    args: [id, locals.user.id],
  });
  if (!res.rowsAffected) return new Response('not found', { status: 404 });
  invalidateExercisesCache(locals.user.id);
  return new Response(null, { status: 204 });
};
