// Browser-side auth client for the Vercel OAuth backend (src/pages/api/auth/*).
//
// No more Google Identity Services, no more 1h-token-with-no-refresh. The
// server holds an encrypted refresh token in an HttpOnly cookie and hands
// out short-lived access tokens on demand via POST /api/auth/token.

const STORAGE_KEY = 'gymlog:auth';
const PROFILE_COOKIE = 'gymlog_profile';

interface CachedToken {
  token: string;
  expiresAt: number;
}

export interface UserProfile {
  email: string;
  name: string;
  picture?: string;
}

/** Thrown by getAccessToken() when the server says the session can't be
 *  refreshed any more (refresh token revoked/expired/missing). Callers
 *  should send the user through signIn() again. */
export class AuthExpiredError extends Error {
  constructor() {
    super('reauth');
    this.name = 'AuthExpiredError';
  }
}

let memoryToken: CachedToken | null = null;
let userProfile: UserProfile | null = null;
let inFlightTokenRequest: Promise<string> | null = null;

// ── cookie / localStorage readers ───────────────────────────────────────

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1] : null;
}

function readProfileFromCookie(): UserProfile | null {
  const raw = readCookie(PROFILE_COOKIE);
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

function readProfileFromStorage(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.profile ?? null;
  } catch {
    return null;
  }
}

function readCachedToken(): CachedToken | null {
  if (memoryToken && memoryToken.expiresAt > Date.now() + 60_000) return memoryToken;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedToken & { profile?: UserProfile };
    if (parsed.expiresAt > Date.now() + 60_000) {
      memoryToken = { token: parsed.token, expiresAt: parsed.expiresAt };
      if (parsed.profile) userProfile = parsed.profile;
      scheduleProactiveRefresh(parsed.expiresAt);
      return memoryToken;
    }
  } catch {}
  return null;
}

function storeToken(token: string, expiresIn: number) {
  const expiresAt = Date.now() + expiresIn * 1000;
  memoryToken = { token, expiresAt };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt, profile: userProfile }));
  } catch {}
  scheduleProactiveRefresh(expiresAt);
}

function clearLocalAuth() {
  memoryToken = null;
  userProfile = null;
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ── proactive refresh ────────────────────────────────────────────────────
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleProactiveRefresh(expiresAt: number) {
  if (refreshTimer) clearTimeout(refreshTimer);
  // Fire 2 minutes before expiry, minimum 30s.
  const delay = Math.max(30_000, expiresAt - Date.now() - 120_000);
  refreshTimer = setTimeout(() => {
    void getAccessToken().catch((e) => {
      console.warn('[auth] proactive refresh failed; will retry on next user action', e);
    });
  }, delay);
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const cached = memoryToken;
    if (!cached) return;
    const remaining = cached.expiresAt - Date.now();
    if (remaining < 5 * 60_000) {
      void getAccessToken().catch(() => {});
    }
  });
}

// ── public API ────────────────────────────────────────────────────────

/** True if this browser has ever completed sign-in — a cookie profile or a
 *  cached profile in localStorage. Doesn't guarantee the refresh token is
 *  still valid server-side; that's only known once getAccessToken() is
 *  actually called. Use this everywhere the real question is "has this
 *  person signed in before", not "do we have a live token right now". */
export function hasSession(): boolean {
  return !!readProfileFromCookie() || !!readProfileFromStorage();
}

/** @deprecated kept as an alias so existing imports keep working. */
export const isSignedIn = hasSession;

export function getCurrentUser(): UserProfile | null {
  if (userProfile) return userProfile;
  const fromCookie = readProfileFromCookie();
  if (fromCookie) { userProfile = fromCookie; return fromCookie; }
  const fromStorage = readProfileFromStorage();
  if (fromStorage) userProfile = fromStorage;
  return userProfile;
}

/** Redirects the browser to the server-side OAuth start endpoint. `next`
 *  is where Google sends the user back to after consenting (defaults to
 *  the current path so a re-auth from mid-app returns them there). */
export function signIn(next?: string): void {
  const target = next ?? (typeof location !== 'undefined' ? location.pathname + location.search : '/');
  const params = new URLSearchParams({ next: target });
  window.location.assign(`/api/auth/start?${params}`);
}

const TOKEN_TIMEOUT_MS = 8_000;

/**
 * Returns a valid access token, refreshing it via the server if the cached
 * one has less than 60s left. Concurrent calls share a single in-flight
 * request. Throws AuthExpiredError if the server says the refresh token is
 * no longer valid (caller should redirect to signIn()).
 */
export async function getAccessToken(): Promise<string> {
  const cached = readCachedToken();
  if (cached) return cached.token;

  if (inFlightTokenRequest) return inFlightTokenRequest;

  inFlightTokenRequest = (async () => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TOKEN_TIMEOUT_MS);
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        credentials: 'same-origin',
        signal: ac.signal,
      });
      if (res.status === 401) {
        clearLocalAuth();
        throw new AuthExpiredError();
      }
      if (!res.ok) {
        let body: any = null;
        try { body = await res.json(); } catch {}
        throw new Error(body?.error ?? `token endpoint failed: ${res.status}`);
      }
      const data = (await res.json()) as { access_token: string; expires_in: number };
      // Refresh the profile from the cookie in case it changed.
      const profile = readProfileFromCookie();
      if (profile) userProfile = profile;
      storeToken(data.access_token, data.expires_in);
      return data.access_token;
    } finally {
      clearTimeout(timer);
    }
  })();

  try {
    return await inFlightTokenRequest;
  } finally {
    inFlightTokenRequest = null;
  }
}

/** Sanitized identifier for the signed-in user, used to prefix per-user
 *  localStorage keys and the OPFS file name so two people sharing the same
 *  browser profile (e.g. a shared family tablet) don't clobber each
 *  other's local caches. Falls back to 'anon' when nobody is signed in. */
export function getStoragePrefix(): string {
  const email = getCurrentUser()?.email;
  if (!email) return 'anon';
  return email.replace(/[^a-zA-Z0-9]/g, '_');
}

export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // best-effort — still clear local state
  }
  clearLocalAuth();
}
