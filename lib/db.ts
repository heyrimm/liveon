import { Pool } from "pg";

const globalForDatabase = globalThis as typeof globalThis & {
  liveOnPool?: Pool;
};

export const db =
  globalForDatabase.liveOnPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.liveOnPool = db;
}
