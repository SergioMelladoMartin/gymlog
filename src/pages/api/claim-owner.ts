import type { APIRoute } from 'astro';
import { db } from '../../lib/db';

export const prerender = false;

/**
 * First-user bootstrap: any rows with NULL user_id get attached to the caller.
 * After the first registration this becomes a no-op.
 */
export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const userId = locals.user.id;

  const orphanRes = await db.execute({
    sql: "SELECT COUNT(*) AS c FROM exercise WHERE user_id IS NULL",
    args: [],
  });
  const orphanCount = Number(orphanRes.rows[0]?.c ?? 0);

  if (orphanCount === 0) {
    return Response.json({ claimed: false, reason: 'already claimed' });
  }

  await db.batch(
    [
      { sql: 'UPDATE exercise        SET user_id = ? WHERE user_id IS NULL', args: [userId] },
      { sql: 'UPDATE training_set    SET user_id = ? WHERE user_id IS NULL', args: [userId] },
      { sql: 'UPDATE workout_comment SET user_id = ? WHERE user_id IS NULL', args: [userId] },
      { sql: 'UPDATE body_weight     SET user_id = ? WHERE user_id IS NULL', args: [userId] },
    ],
    'write',
  );

  return Response.json({ claimed: true, exercises: orphanCount });
};
