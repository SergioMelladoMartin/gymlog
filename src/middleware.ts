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

  if (!ctx.locals.user) {
    if (ctx.request.method !== 'GET') {
      return new Response('Unauthorized', { status: 401 });
    }
    const redirect = encodeURIComponent(path + ctx.url.search);
    return ctx.redirect(`/login?r=${redirect}`);
  }

  const response = await next();

  // Short-lived cache for authenticated GET pages so the browser (and the
  // Vercel edge, with `private`) can replay navigations within ~10s. SWR
  // keeps stale responses usable while the server revalidates in the bg.
  if (
    ctx.request.method === 'GET' &&
    !path.startsWith('/api/') &&
    response.status === 200 &&
    !response.headers.has('Cache-Control')
  ) {
    response.headers.set(
      'Cache-Control',
      'private, max-age=10, stale-while-revalidate=60',
    );
  }

  return response;
});
