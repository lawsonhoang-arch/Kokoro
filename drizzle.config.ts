import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load Next's .env.local first (takes precedence), then .env as a fallback.
config({ path: ".env.local" });
config();

// drizzle-kit runs OUTSIDE Next, so it can't use Next's env loading — we pull
// DATABASE_URL via dotenv (.env.local). `generate` works without a DB; `push`
// / `migrate` / `studio` need the connection string.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // DDL/migrations must NOT go through the transaction pooler — use the direct
    // connection (DIRECT_URL), falling back to DATABASE_URL when unset.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  casing: "snake_case",
});
