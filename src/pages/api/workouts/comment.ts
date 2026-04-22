import type { APIRoute } from 'astro';
import { setWorkoutComment } from '../../../lib/queries';

export const prerender = false;

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const { date, body } = await request.json();
  if (!date) return new Response('date required', { status: 400 });
  await setWorkoutComment(locals.user.id, date, body ?? '');
  return new Response(null, { status: 204 });
};
