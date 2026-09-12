import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let poolInstance: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export function getPool(): Pool {
  if (globalForDb.__arenaNextJsPostgresqlPool) {
    return globalForDb.__arenaNextJsPostgresqlPool;
  }
  if (!poolInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required");
    }
    poolInstance = new Pool({
      connectionString: databaseUrl,
    });
    if (process.env.NODE_ENV !== "production") {
      globalForDb.__arenaNextJsPostgresqlPool = poolInstance;
    }
  }
  return poolInstance;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool());
  }
  return dbInstance;
}

// Keep export for legacy references, but wrapped inside a Proxy so it throws on use, not on import
export const pool = new Proxy({} as Pool, {
  get: (_, prop) => getPool()[prop as keyof Pool]
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get: (_, prop) => getDb()[prop as keyof ReturnType<typeof drizzle>]
});
