import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL ?? 'file:data/gymlog.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const sql = await readFile(new URL('./auth-schema.sql', import.meta.url), 'utf8');
const db = createClient({ url, authToken });

const statements = sql
  .split(';')
  .map((s) => s.replace(/--.*$/gm, '').trim())
  .filter(Boolean);

await db.execute('PRAGMA foreign_keys = OFF');

let ok = 0, skipped = 0;
for (const stmt of statements) {
  try {
    await db.execute(stmt);
    ok++;
  } catch (e: any) {
    if (/duplicate column name|already exists/i.test(e.message)) {
      skipped++;
      continue;
    }
    console.error('Failed statement:\n', stmt.slice(0, 120) + '…\n', e.message);
    throw e;
  }
}

await db.execute('PRAGMA foreign_keys = ON');
console.log(`Applied ${ok} statements (${skipped} skipped as already-applied) on ${url}`);
