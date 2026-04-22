import { betterAuth } from 'better-auth';
import { LibsqlDialect } from '@libsql/kysely-libsql';
import { db } from './db';

const secret =
  import.meta.env?.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;

if (!secret) {
  // Log loudly — auth calls will fail with 500 otherwise.
  console.error('⚠️  BETTER_AUTH_SECRET is not set. Auth endpoints will fail.');
}

const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const vercelProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined;

const baseURL =
  import.meta.env?.BETTER_AUTH_URL ??
  process.env.BETTER_AUTH_URL ??
  vercelProdUrl ??
  vercelUrl ??
  'http://localhost:4321';

const trustedOrigins = Array.from(
  new Set(
    [baseURL, vercelUrl, vercelProdUrl, 'http://localhost:4321', 'http://localhost:3000'].filter(
      (x): x is string => !!x,
    ),
  ),
);

export const auth = betterAuth({
  secret: secret ?? 'insecure-dev-only-please-set-BETTER_AUTH_SECRET',
  baseURL,
  trustedOrigins,
  database: {
    // Reuse the same @libsql/client instance exported from ./db so Vercel
    // bundles only one copy of the native module and all queries share a
    // single HTTP/2 connection to Turso.
    dialect: new LibsqlDialect({ client: db as any }),
    type: 'sqlite',
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  advanced: {
    cookiePrefix: 'gymlog',
  },
});

export type Session = typeof auth.$Infer.Session;
