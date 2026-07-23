import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL이 필요합니다.");
}

const migrationsDirectory = resolve(process.cwd(), "migrations");
const files = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".up.sql"))
  .sort();

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_liveon_migrations" (
      "name" text PRIMARY KEY,
      "checksum" text NOT NULL,
      "appliedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const file of files) {
    const sql = await readFile(resolve(migrationsDirectory, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const applied = await client.query(
      'SELECT "checksum" FROM "_liveon_migrations" WHERE "name" = $1',
      [file]
    );

    if (applied.rowCount) {
      if (applied.rows[0].checksum !== checksum) {
        throw new Error(`이미 적용된 마이그레이션이 변경되었습니다: ${file}`);
      }
      console.log(`건너뜀: ${file}`);
      continue;
    }

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO "_liveon_migrations" ("name", "checksum") VALUES ($1, $2)',
        [file, checksum]
      );
      await client.query("COMMIT");
      console.log(`적용됨: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
