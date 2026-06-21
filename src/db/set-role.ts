import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

// Promote a user to a role. Usage:
//   npm run set-role you@email.com moderator
//   npm run set-role you@email.com admin
async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !["user", "moderator", "admin"].includes(role)) {
    console.error('Usage: npm run set-role <email> <user|moderator|admin>');
    process.exit(1);
  }
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set.");
    process.exit(1);
  }
  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema, casing: "snake_case" });

  const updated = await db
    .update(schema.users)
    .set({ role })
    .where(eq(schema.users.email, email.toLowerCase()))
    .returning({ email: schema.users.email, role: schema.users.role });

  if (updated.length === 0) console.error(`No user found with email ${email}`);
  else console.log(`✓ ${updated[0].email} is now ${updated[0].role}. (Re-login to refresh the session.)`);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
