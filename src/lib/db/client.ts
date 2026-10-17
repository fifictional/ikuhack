import postgres from "postgres";
import { env } from "@/lib/env";

const globalForDb = globalThis as unknown as { __docketSql?: postgres.Sql };

/** Shared postgres.js client (survives Next dev hot reloads). Tiger Cloud URLs include sslmode=require. */
export function db(): postgres.Sql {
  if (!globalForDb.__docketSql) {
    globalForDb.__docketSql = postgres(env.DATABASE_URL, { max: 5, prepare: false });
  }
  return globalForDb.__docketSql;
}
