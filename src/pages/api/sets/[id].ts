import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request }) => {
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
  args.push(id);

  await db.execute({
    sql: `UPDATE training_set SET ${fields.join(', ')} WHERE id = ?`,
    args,
  });
  return new Response(null, { status: 204 });
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!id) return new Response('id required', { status: 400 });
  await db.execute({ sql: 'DELETE FROM training_set WHERE id = ?', args: [id] });
  return new Response(null, { status: 204 });
};
