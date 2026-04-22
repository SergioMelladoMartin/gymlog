import { defineMiddleware } from 'astro:middleware';
import { auth } from './lib/auth';

const PUBLIC_PATHS = ['/login', '/register'];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  const isAuthApi = path.startsWith('/api/auth/');

  // Populate locals with the active session, if any.
  const session = await auth.api.getSession({ headers: ctx.request.headers }).catch(() => null);
  ctx.locals.user = session?.user ?? null;
  ctx.locals.session = session?.session ?? null;

  if (isAuthApi || PUBLIC_PATHS.includes(path)) return next();

  // Protect everything else. Redirect non-GET mutations with 401 so fetches fail fast.
  if (!ctx.locals.user) {
    if (ctx.request.method !== 'GET') {
      return new Response('Unauthorized', { status: 401 });
    }
    const redirect = encodeURIComponent(path + ctx.url.search);
    return ctx.redirect(`/login?r=${redirect}`);
  }

  return next();
});
