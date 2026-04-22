import type { APIRoute } from 'astro';
import { setWorkoutComment } from '../../../lib/queries';

export const prerender = false;

export const PUT: APIRoute = async ({ request }) => {
  const { date, body } = await request.json();
  if (!date) return new Response('date required', { status: 400 });
  await setWorkoutComment(date, body ?? '');
  return new Response(null, { status: 204 });
};
