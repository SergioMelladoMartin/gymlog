import type { APIRoute } from 'astro';
import { db } from '../../lib/db';

export const prerender = false;

/**
 * The existing 131 exercises + 10,918 training sets imported from FitNotes
 * belong to Sergio. Only he can claim them, regardless of registration order.
 * Everyone else starts with an empty workspace (shared categories, nothing
 * else). If the owner re-registers after a wipe he reclaims automatically.
 */
const OWNER_EMAIL = 'sergiomellado15@gmail.com';

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const email = locals.user.email.trim().toLowerCase();

  if (email !== OWNER_EMAIL) {
    return Response.json({ claimed: false, reason: 'not owner' });
  }

  const userId = locals.user.id;

  const orphanRes = await db.execute({
    sql: 'SELECT COUNT(*) AS c FROM training_set WHERE user_id IS NULL',
    args: [],
  });
  const orphanCount = Number(orphanRes.rows[0]?.c ?? 0);

  if (orphanCount === 0) {
    return Response.json({ claimed: false, reason: 'nothing to claim' });
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

  return Response.json({ claimed: true, sets: orphanCount });
};
