import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const g = globalThis as unknown as {
  _pg?: ReturnType<typeof postgres>;
  _pgDirect?: ReturnType<typeof postgres>;
};

const POOLED = process.env.DATABASE_URL;
const DIRECT = process.env.DIRECT_URL ?? POOLED; // fall back in dev
if (!POOLED) throw new Error("DATABASE_URL is not set.");

// Normal request traffic → transaction pooler. Keep max small; the pooler fans out.
const client =
  g._pg ??
  postgres(POOLED, {
    prepare: false,                                  // required for Supavisor
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idle_timeout: 20,
    max_lifetime: 60 * 30,                           // recycle conns
    connect_timeout: 10,
    // A request-path query must never hang the page for tens of seconds. If the
    // DB is overloaded, cancel the statement server-side after ~12s — this frees
    // the pooled connection (so a few slow queries can't cascade-starve the
    // pool) and callers degrade gracefully. Heavy work runs on getDbDirect(),
    // which has no such cap.
    connection: {
      statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 12000),
      idle_in_transaction_session_timeout: 20000,
    },
  });
if (process.env.NODE_ENV !== "production") g._pg = client;
export const db = drizzle(client, { schema, casing: "snake_case" });

// Heavy / streaming work the transaction pooler would cancel (the catalog index
// load) + migrations. One lazy connection, never on the request hot path.
export function getDbDirect() {
  const c =
    g._pgDirect ??
    postgres(DIRECT!, { prepare: false, max: 1, idle_timeout: 10, connect_timeout: 15 });
  if (process.env.NODE_ENV !== "production") g._pgDirect = c;
  return drizzle(c, { schema, casing: "snake_case" });
}