// Reads the OAuth backend's env vars and fails loudly (but safely) when
// they're missing — every endpoint calls this first and turns a thrown
// error into the standard 500 `server_not_configured` response instead of
// crashing with a stack trace or, worse, running with `undefined` secrets.

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  cookieSecret: string;
}

export class ServerNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Missing env vars: ${missing.join(', ')}`);
    this.name = 'ServerNotConfiguredError';
  }
}

export function getAuthConfig(): AuthConfig {
  const clientId = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.GOOGLE_CLIENT_SECRET;
  const cookieSecret = import.meta.env.AUTH_COOKIE_SECRET;
  const missing: string[] = [];
  if (!clientId) missing.push('PUBLIC_GOOGLE_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!cookieSecret) missing.push('AUTH_COOKIE_SECRET');
  if (missing.length) throw new ServerNotConfiguredError(missing);
  return { clientId, clientSecret, cookieSecret };
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=UTF-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function serverNotConfiguredResponse(): Response {
  return jsonResponse(
    { error: 'server_not_configured', message: 'Faltan variables de entorno de autenticación en el servidor.' },
    { status: 500 },
  );
}
