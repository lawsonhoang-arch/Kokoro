// CI preflight: validate DATABASE_URL and confirm the database is actually
// reachable BEFORE the catalog-sync steps run. Turns a vague "exit code 1" into
// a precise, actionable message in the Actions log.
const postgres = require("postgres");

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.log("::error::DATABASE_URL secret is empty/missing. Add it under Settings → Secrets and variables → Actions.");
  process.exit(1);
}

let u;
try {
  u = new URL(raw);
} catch {
  console.log("::error::DATABASE_URL is not a valid URL — likely an unencoded special character in the password (e.g. # → %23).");
  process.exit(1);
}

console.log(`DB host: ${u.hostname}:${u.port || "(default)"}  db: ${u.pathname}`);
// Surface the parsed username in the annotations summary (it's not a secret —
// it appears in every connection string). For Supabase pooler hosts it MUST be
// "postgres.<project-ref>"; a bare "postgres" is the wrong (direct) string.
const usernameOk = u.username.includes(".") || !/pooler\.supabase\.com$/.test(u.hostname);
console.log(`::warning::Preflight parsed user="${u.username}" (password length ${u.password.length}). Pooler hosts need user "postgres.<ref>".`);
if (!usernameOk) {
  console.log(`::error::Username is bare "${u.username}" but a pooler host needs "postgres.<project-ref>". You pasted the Direct-connection string; use the Session pooler string from .env.local's DIRECT_URL.`);
  process.exit(1);
}
if (/^db\..*\.supabase\.co$/.test(u.hostname)) {
  console.log("::error::DATABASE_URL uses the IPv6-only Supabase direct host, unreachable from GitHub's IPv4 runners. Use the Session pooler string (…pooler.supabase.com:5432).");
  process.exit(1);
}

const sql = postgres(raw, { prepare: false, connect_timeout: 15, max: 1 });
sql`select 1 as ok`
  .then((r) => {
    console.log("DB connection OK:", JSON.stringify(r[0]));
    return sql.end();
  })
  .then(() => process.exit(0))
  .catch((e) => {
    const msg = e && e.message ? e.message : String(e);
    console.log("::error::DB connection failed: " + msg);
    // Common Supabase causes, surfaced inline:
    if (/password|authentication|SASL/i.test(msg))
      console.log("::error::→ Authentication failed — the password in the secret is wrong or not URL-encoded.");
    if (/timeout|ETIMEDOUT|ENETUNREACH|ECONNREFUSED/i.test(msg))
      console.log("::error::→ Host unreachable — verify the pooler host and that the Supabase project is not paused.");
    process.exit(1);
  });
