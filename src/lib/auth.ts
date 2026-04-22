import { betterAuth } from 'better-auth';
import { LibsqlDialect } from '@libsql/kysely-libsql';

const url =
  import.meta.env?.TURSO_DATABASE_URL ??
  process.env.TURSO_DATABASE_URL ??
  'file:data/gymlog.db';
const authToken = import.meta.env?.TURSO_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;
const secret =
  import.meta.env?.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;

// Prefer explicit config; otherwise infer from Vercel's system env.
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

// Allow current deployment's host + explicit prod URL + localhost to submit
// auth requests. Prevents Better-Auth from rejecting Vercel preview URLs.
const trustedOrigins = Array.from(
  new Set(
    [baseURL, vercelUrl, vercelProdUrl, 'http://localhost:4321', 'http://localhost:3000'].filter(
      (x): x is string => !!x,
    ),
  ),
);

export const auth = betterAuth({
  secret,
  baseURL,
  trustedOrigins,
  database: {
    dialect: new LibsqlDialect({ url, authToken }),
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
