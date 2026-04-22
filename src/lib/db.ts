import { createClient, type Client } from '@libsql/client';

// Works both under Astro (import.meta.env) and plain Node (process.env).
const viteEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env ?? {} : {};
const url = viteEnv.TURSO_DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? 'file:data/gymlog.db';
const authToken = viteEnv.TURSO_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;

export const db: Client = createClient({ url, authToken });
