import type { APIRoute } from 'astro';
import { getAuthConfig, serverNotConfiguredResponse, ServerNotConfiguredError } from '../../../lib/server/config';
import { decryptString } from '../../../lib/server/crypto';

export const prerender = false;

const RT_COOKIE = 'gymlog_rt';
const PROFILE_COOKIE = 'gymlog_profile';

export const POST: APIRoute = async ({ cookies }) => {
  let config;
  try {
    config = getAuthConfig();
  } catch (e) {
    if (e instanceof ServerNotConfiguredError) return serverNotConfiguredResponse();
    throw e;
  }

  const encrypted = cookies.get(RT_COOKIE)?.value;
  if (encrypted) {
    try {
      const refreshToken = await decryptString(encrypted, config.cookieSecret);
      // Best-effort — the user is signing out regardless of whether Google
      // acknowledges the revoke.
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }),
      }).catch(() => {});
    } catch {
      // malformed/undecryptable cookie — nothing to revoke, just clear it
    }
  }

  cookies.delete(RT_COOKIE, { path: '/api/auth' });
  cookies.delete(PROFILE_COOKIE, { path: '/' });

  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
};
