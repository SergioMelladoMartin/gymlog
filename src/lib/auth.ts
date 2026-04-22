import { betterAuth } from 'better-auth';
import { LibsqlDialect } from '@libsql/kysely-libsql';

const url = import.meta.env?.TURSO_DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? 'file:data/gymlog.db';
const authToken = import.meta.env?.TURSO_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;
const secret = import.meta.env?.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;
const baseURL = import.meta.env?.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:4321';

export const auth = betterAuth({
  secret,
  baseURL,
  database: {
    dialect: new LibsqlDialect({ url, authToken }),
    type: 'sqlite',
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // We seed the owner user; no need for open sign-ups by default, but the
    // first sign-up is allowed so self-registration still works.
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,    // 30 days
    updateAge: 60 * 60 * 24,         // refresh once per day
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  advanced: {
    cookiePrefix: 'gymlog',
  },
});

export type Session = typeof auth.$Infer.Session;
