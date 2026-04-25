// Google Identity Services (GIS) browser-only OAuth + Drive API helpers.
// No backend, no cookies, no refresh tokens stored. GIS hands us a short-
// lived access token (~1h) that we cache in memory and re-acquire silently
// when the user returns.

const CLIENT_ID = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID as string | undefined;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const PROFILE_SCOPES = 'openid email profile';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (r: TokenResponse & { error?: string }) => void;
            error_callback?: (e: { type: string; message?: string }) => void;
          }): { requestAccessToken: (opts?: { prompt?: string }) => void };
          revoke(token: string, done?: () => void): void;
        };
      };
    };
  }
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

const STORAGE_KEY = 'gymlog:auth';
let memoryToken: CachedToken | null = null;
let userProfile: UserProfile | null = null;
let gisLoaded: Promise<void> | null = null;

export interface UserProfile {
  email: string;
  name: string;
  picture?: string;
}

// ── GIS script loader ────────────────────────────────────────────────────
function loadGis(): Promise<void> {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no window'));
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
  return gisLoaded;
}

function readCachedToken(): CachedToken | null {
  if (memoryToken && memoryToken.expiresAt > Date.now() + 30_000) return memoryToken;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedToken & { profile?: UserProfile };
    if (parsed.expiresAt > Date.now() + 30_000) {
      memoryToken = { token: parsed.token, expiresAt: parsed.expiresAt };
      if (parsed.profile) userProfile = parsed.profile;
      // Re-arm the proactive refresh timer for tokens loaded from a
      // previous session — otherwise we'd only schedule it the very
      // first time storeToken runs in this page lifetime.
      scheduleProactiveRefresh(parsed.expiresAt);
      return memoryToken;
    }
  } catch {}
  return null;
}

function storeToken(token: string, expiresIn: number, profile?: UserProfile) {
  const expiresAt = Date.now() + expiresIn * 1000;
  memoryToken = { token, expiresAt };
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token, expiresAt, profile: profile ?? userProfile }),
    );
  } catch {}
  if (profile) userProfile = profile;
  scheduleProactiveRefresh(expiresAt);
}

// ── proactive silent refresh ─────────────────────────────────────────────
//
// Google's browser-only OAuth flow only ever issues 1 h access tokens.
// Without a refresh token (which would require a backend secret), the
// only way to keep the session alive is to silently re-request a token
// while we still have a valid Google session cookie — `prompt: ''`.
//
// Doing it lazily (only when the token actually runs out) means a stale
// or paused tab can lose the chance, and the user is forced to re-auth.
// Refreshing ~2 min before expiry while the tab is foregrounded turns
// this into a no-op for Chrome / Firefox / Edge (silent refresh works,
// user sees nothing). On iOS Safari with third-party cookies blocked
// the silent attempt may still fail, but at most once an hour — and a
// single tap on the sync pill recovers.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleProactiveRefresh(expiresAt: number) {
  if (refreshTimer) clearTimeout(refreshTimer);
  // Fire 2 minutes before expiry, with a sane minimum of 30 s.
  const delay = Math.max(30_000, expiresAt - Date.now() - 120_000);
  refreshTimer = setTimeout(() => {
    void silentRefresh();
  }, delay);
}

async function silentRefresh(): Promise<void> {
  // Skip if the user is offline or the tab is hidden — we'll try again
  // when they come back.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    // try again when foregrounded
    return;
  }
  // Force a refresh even if the cached token still has time left, by
  // wiping the in-memory copy first. localStorage stays as a fallback.
  memoryToken = null;
  try {
    await getAccessToken(false); // silent, will reschedule on success
  } catch (e) {
    console.warn('[auth] proactive refresh failed; will retry on next user action', e);
    // On failure don't keep retrying in a loop — wait for user activity.
  }
}

if (typeof window !== 'undefined') {
  // When the tab comes back into focus, top up the token if we missed a
  // scheduled refresh while hidden / suspended (mobile lifecycle).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const cached = memoryToken;
    if (!cached) return;
    const remaining = cached.expiresAt - Date.now();
    if (remaining < 5 * 60_000) void silentRefresh();
  });
  window.addEventListener('online', () => {
    const cached = memoryToken;
    if (!cached) return;
    const remaining = cached.expiresAt - Date.now();
    if (remaining < 5 * 60_000) void silentRefresh();
  });
}

// ── public API ───────────────────────────────────────────────────────────

export function getClientId(): string {
  if (!CLIENT_ID) {
    throw new Error(
      'Missing PUBLIC_GOOGLE_CLIENT_ID env var — set it in .env and restart the dev server.',
    );
  }
  return CLIENT_ID;
}

export function getCurrentUser(): UserProfile | null {
  if (userProfile) return userProfile;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.profile) userProfile = parsed.profile;
    }
  } catch {}
  return userProfile;
}

export function isSignedIn(): boolean {
  return !!readCachedToken();
}

/**
 * Returns a valid access token, re-prompting the user silently if the
 * cached one is expired. Throws if no token can be obtained.
 *
 * Wrapped in a 12 s timeout: silent refresh on iOS / strict-cookie
 * browsers occasionally never resolves (no callback, no error). Without
 * the timeout the whole sync pipeline would hang on its caller.
 */
const TOKEN_TIMEOUT_MS = 12_000;

export async function getAccessToken(interactive = false): Promise<string> {
  const cached = readCachedToken();
  if (cached) return cached.token;

  await loadGis();

  const tokenPromise = new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: `${DRIVE_SCOPE} ${PROFILE_SCOPES}`,
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? 'No access token'));
          return;
        }
        // Validate that the user actually granted the Drive scope — Google
        // will happily issue a token for a subset of requested scopes if the
        // user unticks a checkbox on the consent screen.
        if (!resp.scope?.includes(DRIVE_SCOPE)) {
          reject(
            new Error(
              'Faltan permisos de Drive. En la pantalla de Google, marca la casilla "Ver, crear y eliminar datos de esta aplicación en tu Google Drive". Si no aparece, añade el scope drive.appdata en tu OAuth consent screen.',
            ),
          );
          return;
        }
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${resp.access_token}` },
        });
        const profile: UserProfile = profileRes.ok
          ? await profileRes.json().then((p) => ({
              email: p.email,
              name: p.name ?? p.email,
              picture: p.picture,
            }))
          : { email: 'unknown', name: 'Usuario' };
        storeToken(resp.access_token, resp.expires_in, profile);
        resolve(resp.access_token);
      },
      error_callback: (e) => reject(new Error(e.message ?? e.type)),
    });
    // prompt:'consent' re-asks for permissions (useful after a 403 to let
    // the user re-tick the Drive checkbox). Empty = silent re-auth.
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });

  return Promise.race([
    tokenPromise,
    new Promise<string>((_, reject) =>
      setTimeout(
        () => reject(new Error('Tiempo agotado pidiendo token a Google. ¿Cookies bloqueadas? Toca el indicador de sync para reintentar de forma interactiva.')),
        TOKEN_TIMEOUT_MS,
      ),
    ),
  ]);
}

/** Force a re-consent flow (used after a 403 from Drive). */
export async function reconsent(): Promise<string> {
  memoryToken = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  return getAccessToken(true);
}

export async function signIn(): Promise<UserProfile> {
  await getAccessToken(true);
  return getCurrentUser()!;
}

export async function signOut(): Promise<void> {
  const cached = readCachedToken();
  if (cached?.token) {
    await loadGis().catch(() => {});
    try {
      window.google?.accounts.oauth2.revoke(cached.token);
    } catch {}
  }
  memoryToken = null;
  userProfile = null;
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
