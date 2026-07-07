// Google Identity Services (GIS) browser-only OAuth + Drive API helpers.
// No backend, no refresh tokens stored. GIS hands us a short-lived access
// token (~1h) that we cache in memory and re-acquire silently while the
// user's Google session cookie is still valid.
//
// Session model:
//   • hasAccount()  — user profile persisted (stays logged in across token expiry)
//   • hasValidToken() — access token still usable for Drive API calls
//   • isSignedIn()  — alias for hasAccount() (backward compat)

const CLIENT_ID = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID as string | undefined;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const PROFILE_SCOPES = 'openid email profile';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

const TOKEN_TIMEOUT_MS = 12_000;
const PERIODIC_REFRESH_MS = 45 * 60_000;

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

export type AuthStatus = 'signed_out' | 'token_valid' | 'token_expired';

const STORAGE_KEY = 'gymlog:auth';
let memoryToken: CachedToken | null = null;
let userProfile: UserProfile | null = null;
let gisLoaded: Promise<void> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let periodicTimer: ReturnType<typeof setInterval> | null = null;
let pendingRefreshOnVisible = false;
const authListeners = new Set<(status: AuthStatus) => void>();

export interface UserProfile {
  email: string;
  name: string;
  picture?: string;
}

function notifyAuthChange(): void {
  const status = getAuthStatus();
  for (const l of authListeners) l(status);
}

export function getAuthStatus(): AuthStatus {
  if (!getCurrentUser()) return 'signed_out';
  if (hasValidToken()) return 'token_valid';
  return 'token_expired';
}

export function onAuthChange(fn: (status: AuthStatus) => void): () => void {
  authListeners.add(fn);
  fn(getAuthStatus());
  return () => { authListeners.delete(fn); };
}

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

function readStoredAuth(): (CachedToken & { profile?: UserProfile }) | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readCachedToken(): CachedToken | null {
  if (memoryToken && memoryToken.expiresAt > Date.now() + 30_000) return memoryToken;
  const parsed = readStoredAuth();
  if (!parsed?.token || !parsed.expiresAt) return null;
  if (parsed.expiresAt > Date.now() + 30_000) {
    memoryToken = { token: parsed.token, expiresAt: parsed.expiresAt };
    if (parsed.profile) userProfile = parsed.profile;
    scheduleProactiveRefresh(parsed.expiresAt);
    startPeriodicRefresh();
    return memoryToken;
  }
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
  startPeriodicRefresh();
  notifyAuthChange();
}

function scheduleProactiveRefresh(expiresAt: number) {
  if (refreshTimer) clearTimeout(refreshTimer);
  const delay = Math.max(30_000, expiresAt - Date.now() - 120_000);
  refreshTimer = setTimeout(() => { void silentRefresh(); }, delay);
}

function startPeriodicRefresh() {
  if (periodicTimer || typeof window === 'undefined') return;
  periodicTimer = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (!hasAccount()) return;
    void silentRefresh();
  }, PERIODIC_REFRESH_MS);
}

function stopPeriodicRefresh() {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
}

async function silentRefresh(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    pendingRefreshOnVisible = true;
    return;
  }
  pendingRefreshOnVisible = false;
  if (!hasAccount()) return;
  memoryToken = null;
  try {
    await getAccessToken(false);
  } catch (e) {
    console.warn('[auth] silent refresh failed; will retry on next user action', e);
    notifyAuthChange();
  }
}

if (typeof window !== 'undefined') {
  // Bootstrap timers when a previous session left a profile + token in LS.
  readCachedToken();
  if (hasAccount() && !hasValidToken()) notifyAuthChange();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!hasAccount()) return;
    if (pendingRefreshOnVisible || !hasValidToken()) void silentRefresh();
  });

  window.addEventListener('online', () => {
    if (!hasAccount()) return;
    if (!hasValidToken()) void silentRefresh();
  });
}

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
  const parsed = readStoredAuth();
  if (parsed?.profile) userProfile = parsed.profile;
  return userProfile;
}

/** User has linked a Google account (profile persisted). */
export function hasAccount(): boolean {
  return !!getCurrentUser();
}

/** Access token is still valid for Drive API calls. */
export function hasValidToken(): boolean {
  return !!readCachedToken();
}

/** @deprecated Use hasAccount() — kept for callers that mean "logged in". */
export function isSignedIn(): boolean {
  return hasAccount();
}

/**
 * Ensure we can talk to Drive. Tries a silent token refresh when the
 * profile exists but the cached token has expired.
 */
export async function ensureDriveAccess(interactive = false): Promise<boolean> {
  if (!hasAccount()) return false;
  if (hasValidToken()) return true;
  try {
    await getAccessToken(interactive);
    return true;
  } catch {
    notifyAuthChange();
    return false;
  }
}

export async function renewAccess(interactive = true): Promise<boolean> {
  if (!hasAccount()) return false;
  memoryToken = null;
  try {
    await getAccessToken(interactive);
    return true;
  } catch {
    notifyAuthChange();
    return false;
  }
}

export async function getAccessToken(interactive = false): Promise<string> {
  const cached = readCachedToken();
  if (cached) return cached.token;

  if (!hasAccount() && !interactive) {
    throw new Error('Sesión de Google caducada. Toca el indicador de sync para renovar.');
  }

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
          : getCurrentUser() ?? { email: 'unknown', name: 'Usuario' };
        storeToken(resp.access_token, resp.expires_in, profile);
        resolve(resp.access_token);
      },
      error_callback: (e) => reject(new Error(e.message ?? e.type)),
    });
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });

  return Promise.race([
    tokenPromise,
    new Promise<string>((_, reject) =>
      setTimeout(
        () => reject(new Error('Tiempo agotado pidiendo token a Google. ¿Cookies bloqueadas? Toca el indicador de sync para reintentar.')),
        TOKEN_TIMEOUT_MS,
      ),
    ),
  ]);
}

/** Force a re-consent flow (used after a 403 from Drive). Preserves profile. */
export async function reconsent(): Promise<string> {
  const profile = getCurrentUser();
  memoryToken = null;
  try {
    if (profile) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: '', expiresAt: 0, profile }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
  notifyAuthChange();
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
  stopPeriodicRefresh();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  notifyAuthChange();
}
