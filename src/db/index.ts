import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Hot-reload-safe singleton: Next's dev server re-evaluates modules on every
// change, which would otherwise open a new pool each time and exhaust Supabase
// connections. Cache the client on globalThis in dev.
const globalForDb = globalThis as unknown as {
  _pgClient?: ReturnType<typeof postgres>;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Surfaced clearly instead of a cryptic driver error at first query.
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and add your Supabase connection string.",
  );
}

// prepare:false keeps us compatible with Supabase's transaction pooler (6543).
const client =
  globalForDb._pgClient ?? postgres(connectionString, { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb._pgClient = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
