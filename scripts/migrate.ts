import { config } from "dotenv";
config({ path: ".env.local" });

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db/client";

/** Applies db/migrations/*.sql in order, once each. */
async function main() {
  const sql = db();
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())`;
  const dir = path.join(process.cwd(), "db/migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const [done] = await sql`SELECT 1 FROM schema_migrations WHERE name = ${file}`;
    if (done) continue;
    console.log(`applying ${file}`);
    // Not wrapped in a transaction: continuous aggregates can't be created inside one.
    await sql.unsafe(await readFile(path.join(dir, file), "utf8"));
    await sql`INSERT INTO schema_migrations (name) VALUES (${file})`;
  }
  console.log("migrations up to date");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
