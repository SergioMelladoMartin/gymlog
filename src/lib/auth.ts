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
 */
export async function getAccessToken(interactive = false): Promise<string> {
  const cached = readCachedToken();
  if (cached) return cached.token;

  await loadGis();

  return new Promise<string>((resolve, reject) => {
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
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
