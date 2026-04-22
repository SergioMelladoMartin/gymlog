import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL ?? 'file:data/gymlog.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
const db = createClient({ url, authToken });

const statements = sql
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  await db.execute(stmt);
}

console.log(`Applied ${statements.length} statements to ${url}`);
