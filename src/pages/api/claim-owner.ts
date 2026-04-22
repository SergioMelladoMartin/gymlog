import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { invalidateSetsCache } from '../../lib/queries';

export const prerender = false;

/**
 * First-user-wins claim. When the authenticated user calls this endpoint:
 *   - If no training_set row has ever been assigned to any user, attach all
 *     current orphan rows to the caller.
 *   - Otherwise return {claimed:false, reason:'already claimed'}.
 *
 * This preserves isolation (only one user owns the seed data) while avoiding
 * strict email pinning that can trip up after account recreation.
 */
export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const userId = locals.user.id;

  const alreadyClaimed = await db.execute({
    sql: 'SELECT 1 FROM training_set WHERE user_id IS NOT NULL LIMIT 1',
  });
  if (alreadyClaimed.rows.length) {
    return Response.json({ claimed: false, reason: 'already claimed' });
  }

  const orphanRes = await db.execute({
    sql: 'SELECT COUNT(*) AS c FROM training_set WHERE user_id IS NULL',
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

  invalidateSetsCache(userId);
  return Response.json({ claimed: true, sets: orphanCount });
};
