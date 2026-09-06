import type { APIRoute } from 'astro';
import { getAuthConfig, serverNotConfiguredResponse, ServerNotConfiguredError } from '../../../lib/server/config';
import { randomToken } from '../../../lib/server/crypto';

export const prerender = false;

const STATE_COOKIE = 'gymlog_oauth_state';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const PROFILE_SCOPES = 'openid email profile';

/** Only allow redirecting back into our own app — never an open redirect. */
function safeNext(next: string | null): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export const GET: APIRoute = async ({ request, redirect, cookies }) => {
  let config;
  try {
    config = getAuthConfig();
  } catch (e) {
    if (e instanceof ServerNotConfiguredError) return serverNotConfiguredResponse();
    throw e;
  }

  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));
  const force = url.searchParams.get('force') === '1';

  const state = randomToken(24);
  cookies.set(STATE_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 10 * 60,
  });

  const redirectUri = `${url.origin}/api/auth/callback`;
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    scope: `${DRIVE_SCOPE} ${PROFILE_SCOPES}`,
    state,
  });
  if (force) params.set('prompt', 'consent');

  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
};
