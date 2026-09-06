import type { APIRoute } from 'astro';
import { getAuthConfig, serverNotConfiguredResponse, ServerNotConfiguredError } from '../../../lib/server/config';
import { encryptString, timingSafeEqual } from '../../../lib/server/crypto';

export const prerender = false;

const STATE_COOKIE = 'gymlog_oauth_state';
const RT_COOKIE = 'gymlog_rt';
const PROFILE_COOKIE = 'gymlog_profile';
const MAX_AGE = 400 * 24 * 60 * 60; // 400 days, Chrome's own cookie cap
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

function safeNext(next: string | null | undefined): string {
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
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const stateCookieRaw = cookies.get(STATE_COOKIE)?.value;
  cookies.delete(STATE_COOKIE, { path: '/api/auth' });

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error)}`, 302);
  }

  let expectedState = '';
  let next = '/';
  try {
    const parsed = stateCookieRaw ? JSON.parse(stateCookieRaw) : null;
    expectedState = parsed?.state ?? '';
    next = safeNext(parsed?.next);
  } catch {}

  if (!code || !returnedState || !expectedState || !timingSafeEqual(returnedState, expectedState)) {
    return redirect('/login?error=state_mismatch', 302);
  }

  // redirect_uri is always derived from our own origin, never from the
  // query string, so it can't be redirected to an attacker-controlled URL.
  const redirectUri = `${url.origin}/api/auth/callback`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return redirect('/login?error=token_exchange_failed', 302);
  }
  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    scope?: string;
    expires_in: number;
  };

  if (!tokenData.scope?.includes(DRIVE_SCOPE)) {
    return redirect('/login?error=missing_scope', 302);
  }
  if (!tokenData.refresh_token) {
    // Google only issues a refresh token the FIRST time a user consents
    // (or when prompt=consent forces re-issuance). If we don't have one
    // stored already, ask for a fresh consent so we get one.
    return redirect('/api/auth/start?force=1&next=' + encodeURIComponent(next), 302);
  }

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = profileRes.ok
    ? await profileRes.json().then((p: any) => ({ email: p.email, name: p.name ?? p.email, picture: p.picture }))
    : { email: 'unknown', name: 'Usuario' };

  const encryptedRt = await encryptString(tokenData.refresh_token, config.cookieSecret);

  cookies.set(RT_COOKIE, encryptedRt, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: MAX_AGE,
  });
  cookies.set(PROFILE_COOKIE, encodeURIComponent(JSON.stringify(profile)), {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });

  const res = redirect(next, 302);
  res.headers.set('Cache-Control', 'no-store');
  return res;
};
