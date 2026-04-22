import { createClient, type Client } from '@libsql/client';

const url = import.meta.env.TURSO_DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? 'file:data/gymlog.db';
const authToken = import.meta.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;

export const db: Client = createClient({ url, authToken });
