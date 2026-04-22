import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { getExercises } from '../../lib/queries';

export const prerender = false;

export const GET: APIRoute = async () => {
  const exercises = await getExercises();
  return Response.json(exercises);
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const name = (body.name as string | undefined)?.trim();
  const category_id = Number(body.category_id);

  if (!name) return new Response('name required', { status: 400 });
  if (!category_id) return new Response('category_id required', { status: 400 });
  if (name.length > 80) return new Response('name too long', { status: 400 });

  const exists = await db.execute({
    sql: 'SELECT id FROM exercise WHERE LOWER(name) = LOWER(?) LIMIT 1',
    args: [name],
  });
  if (exists.rows[0]) {
    return new Response(JSON.stringify({ error: 'Ya existe un ejercicio con ese nombre' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    });
  }

  const res = await db.execute({
    sql: `INSERT INTO exercise (name, category_id, is_favorite)
          VALUES (?, ?, 0)
          RETURNING id`,
    args: [name, category_id],
  });
  const id = res.rows[0]?.id as number;

  const row = await db.execute({
    sql: `SELECT e.id, e.name, e.category_id, c.name AS category_name, c.color AS category_color,
                 e.is_favorite, NULL AS last_used
          FROM exercise e JOIN category c ON c.id = e.category_id
          WHERE e.id = ?`,
    args: [id],
  });

  return Response.json(row.rows[0]);
};
