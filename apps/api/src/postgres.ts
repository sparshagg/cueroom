import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

export type PostgresPool = pg.Pool;
export type PostgresClient = pg.PoolClient;

export function createPostgresPool(connectionString = process.env.POSTGRES_URL) {
  if (!connectionString) {
    throw new Error("POSTGRES_URL is required for the Postgres room store");
  }

  return new Pool({
    connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    max: Number(process.env.POSTGRES_POOL_MAX ?? 10)
  });
}

export async function withTransaction<T>(
  pool: PostgresPool,
  callback: (client: PostgresClient) => Promise<T>
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function runPostgresMigrations(pool: PostgresPool) {
  const migrationNames = await listMigrations();
  for (const migrationName of migrationNames) {
    const migrationSql = await readMigration(migrationName);
    await pool.query(migrationSql);
  }
}

async function listMigrations() {
  const candidates = [
    path.resolve(process.cwd(), "migrations"),
    path.resolve(process.cwd(), "apps/api/migrations")
  ];

  for (const candidate of candidates) {
    try {
      const entries = await fs.readdir(candidate);
      return entries.filter((entry) => entry.endsWith(".sql")).sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error("Unable to find Postgres migrations directory");
}

async function readMigration(fileName: string) {
  const candidates = [
    path.resolve(process.cwd(), "migrations", fileName),
    path.resolve(process.cwd(), "apps/api/migrations", fileName)
  ];

  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error(`Unable to find Postgres migration ${fileName}`);
}
