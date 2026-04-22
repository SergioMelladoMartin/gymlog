import type { APIRoute } from 'astro';
import { getSetsForDate, getWorkoutComment } from '../../../../lib/queries';
import { renderShareCardPng } from '../../../../lib/share-card';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const date = params.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response('invalid date', { status: 400 });
  }

  const sets = await getSetsForDate(locals.user.id, date);
  if (!sets.length) {
    return new Response('No hay entrenamiento ese día', { status: 404 });
  }
  const comment = await getWorkoutComment(locals.user.id, date);

  const groupMap = new Map<number, { name: string; category_color: string | null; sets: typeof sets }>();
  for (const s of sets) {
    if (!groupMap.has(s.exercise_id)) {
      groupMap.set(s.exercise_id, { name: s.exercise_name, category_color: s.category_color, sets: [] });
    }
    groupMap.get(s.exercise_id)!.sets.push(s);
  }
  const groups = Array.from(groupMap.values());

  const totalSets = sets.length;
  const totalExercises = groups.length;
  const totalVolume = sets.reduce((acc, s) => acc + s.weight_kg * s.reps, 0);

  // Best 1RM across today's sets
  let best1RM: { exercise: string; value: number } | undefined;
  for (const s of sets) {
    const est = s.weight_kg * (1 + s.reps / 30);
    if (!best1RM || est > best1RM.value) best1RM = { exercise: s.exercise_name, value: est };
  }

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const png = await renderShareCardPng({
    dateLabel,
    totalSets,
    totalExercises,
    totalVolume,
    best1RM,
    groups,
    comment: comment ?? null,
  });

  return new Response(png, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="gymlog-${date}.png"`,
      'Cache-Control': 'no-store',
    },
  });
};
