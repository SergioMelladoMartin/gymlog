import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const userId = locals.user.id;
  const id = Number(params.id);
  if (!id) return new Response('id required', { status: 400 });

  const body = await request.json();
  const fields: string[] = [];
  const args: (number | string)[] = [];

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) return new Response('name empty', { status: 400 });
    if (name.length > 80) return new Response('name too long', { status: 400 });
    const exists = await db.execute({
      sql: 'SELECT id FROM exercise WHERE user_id = ? AND LOWER(name) = LOWER(?) AND id != ? LIMIT 1',
      args: [userId, name, id],
    });
    if (exists.rows[0]) {
      return new Response(JSON.stringify({ error: 'Ya existe otro ejercicio con ese nombre' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      });
    }
    fields.push('name = ?');
    args.push(name);
  }

  if (typeof body.category_id === 'number') {
    fields.push('category_id = ?');
    args.push(body.category_id);
  }

  if (!fields.length) return new Response('no fields', { status: 400 });
  args.push(id, userId);

  const res = await db.execute({
    sql: `UPDATE exercise SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    args,
  });
  if (!res.rowsAffected) return new Response('not found', { status: 404 });
  return new Response(null, { status: 204 });
};
