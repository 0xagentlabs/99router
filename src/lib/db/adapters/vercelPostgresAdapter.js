import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sql } from "@vercel/postgres";

// Compatibility layer for the existing synchronous SQLite repositories. A
// function instance works against SQLite in /tmp, while the durable snapshot
// lives in Vercel Postgres. This keeps the upstream code easy to merge.
const TABLE = "_9router_sqlite_snapshots";
const KEY = process.env.VERCEL_DB_SNAPSHOT_KEY || "default";

export async function createVercelPostgresSqliteAdapter(createSqlJsAdapter) {
  await sql.query(`CREATE TABLE IF NOT EXISTS ${TABLE} (key TEXT PRIMARY KEY, data BYTEA NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const result = await sql.query(`SELECT data FROM ${TABLE} WHERE key = $1`, [KEY]);
  const filePath = path.join(os.tmpdir(), `9router-${KEY.replace(/[^a-zA-Z0-9_-]/g, "_")}.sqlite`);
  const snapshot = result.rows[0]?.data;
  if (snapshot) await fs.writeFile(filePath, Buffer.isBuffer(snapshot) ? snapshot : Buffer.from(snapshot));

  const adapter = await createSqlJsAdapter(filePath, {
    onPersist: async (bytes) => {
      await sql.query(
        `INSERT INTO ${TABLE}(key, data, updated_at) VALUES($1, $2, NOW())
         ON CONFLICT(key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [KEY, bytes],
      );
    },
  });
  return { ...adapter, driver: "sql.js+vercel-postgres" };
}
