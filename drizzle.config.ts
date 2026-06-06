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
    url: process.env.DATABASE_URL ?? "",
  },
  casing: "snake_case",
});
