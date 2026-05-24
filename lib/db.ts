import mysql, { type RowDataPacket } from "mysql2/promise";

// Read-only connection to the Nizami Farms operational MySQL (StackCP).
// IMPORTANT: this server only accepts NON-SSL connections (no ssl option).
// This PoC never writes back to the database.

declare global {
  // eslint-disable-next-line no-var
  var __nfProcPool: mysql.Pool | undefined;
}

function createPool(): mysql.Pool {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_PASS || !DB_NAME) {
    throw new Error(
      "Missing DB_* env vars (expected DB_HOST/PORT/USER/PASS/NAME in .env.local)",
    );
  }
  return mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT ?? 3306),
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    connectionLimit: 4,
    connectTimeout: 15000,
    dateStrings: true, // keep dates as strings; we bucket by YYYY-MM-DD
  });
}

export function getPool(): mysql.Pool {
  if (!global.__nfProcPool) global.__nfProcPool = createPool();
  return global.__nfProcPool;
}

export async function query<T = RowDataPacket>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(sql, params);
  return rows as unknown as T[];
}

export function dbName(): string {
  return process.env.DB_NAME ?? "";
}
