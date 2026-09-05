import type { APIRoute } from 'astro';
import { getAuthConfig, jsonResponse, serverNotConfiguredResponse, ServerNotConfiguredError } from '../../../lib/server/config';
import { decryptString } from '../../../lib/server/crypto';

export const prerender = false;

const RT_COOKIE = 'gymlog_rt';
const PROFILE_COOKIE = 'gymlog_profile';

function clearCookies(cookies: import('astro').AstroCookies) {
  cookies.delete(RT_COOKIE, { path: '/api/auth' });
  cookies.delete(PROFILE_COOKIE, { path: '/' });
}

export const POST: APIRoute = async ({ cookies }) => {
  let config;
  try {
    config = getAuthConfig();
  } catch (e) {
    if (e instanceof ServerNotConfiguredError) return serverNotConfiguredResponse();
    throw e;
  }

  const encrypted = cookies.get(RT_COOKIE)?.value;
  if (!encrypted) {
    return jsonResponse({ error: 'reauth' }, { status: 401 });
  }

  let refreshToken: string;
  try {
    refreshToken = await decryptString(encrypted, config.cookieSecret);
  } catch {
    clearCookies(cookies);
    return jsonResponse({ error: 'reauth' }, { status: 401 });
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    let body: any = null;
    try { body = await res.json(); } catch {}
    if (body?.error === 'invalid_grant') {
      clearCookies(cookies);
      return jsonResponse({ error: 'reauth' }, { status: 401 });
    }
    return jsonResponse({ error: 'token_refresh_failed' }, { status: 502 });
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  // Never echo the refresh token back to the client.
  return jsonResponse({ access_token: data.access_token, expires_in: data.expires_in });
};
