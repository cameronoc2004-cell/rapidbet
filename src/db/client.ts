import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

declare global {
  // eslint-disable-next-line no-var
  var __rapidBetPg: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __rapidBetDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

// pgbouncer in transaction-pool mode (port 6543) doesn't support prepared
// statements — postgres.js needs `prepare: false`.
const sqlClient =
  globalThis.__rapidBetPg ??
  postgres(connectionString, {
    prepare: false,
    max: 10,
  });

export const db = globalThis.__rapidBetDb ?? drizzle(sqlClient, { schema });

if (process.env.NODE_ENV !== "production") {
  globalThis.__rapidBetPg = sqlClient;
  globalThis.__rapidBetDb = db;
}

export { sqlClient as pg };
