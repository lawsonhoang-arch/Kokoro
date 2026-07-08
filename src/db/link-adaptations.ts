import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Links each manga to its anime adaptation(s) so they share one community.
// Reads MAL "Adaptation" relations from Jikan, matches the related anime to our
// catalog by mal_id, and stamps a shared `series_id` on all of them. Idempotent
// and re-runnable. Run: `npm run db:link-adaptations`.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Rel = { relation: string; entry?: { mal_id: number; type: string }[] };

async function relations(malId: number, attempt = 0): Promise<Rel[]> {
  try {
    const r = await fetch(`https://api.jikan.moe/v4/manga/${malId}/relations`, {
      headers: { accept: "application/json" },
    });
    if (r.status === 429) {
      if (attempt >= 5) return [];
      await sleep(1500 * (attempt + 1));
      return relations(malId, attempt + 1);
    }
    if (!r.ok) return [];
    const j = (await r.json()) as { data?: Rel[] };
    return j.data ?? [];
  } catch {
    if (attempt >= 3) return [];
    await sleep(1000 * (attempt + 1));
    return relations(malId, attempt + 1);
  }
}

async function main() {
  await sql`alter table titles add column if not exists series_id text`;
  await sql`create index if not exists titles_series_idx on titles(series_id)`;

  const manga = (await sql`select id from titles where kind = 'manga' and id like 'mga:%'`) as { id: string }[];
  console.log(`Linking adaptations for ${manga.length} manga…`);

  let linked = 0;
  for (const m of manga) {
    const malId = parseInt(m.id.slice(4), 10);
    if (!malId) continue;

    const rels = await relations(malId);
    const animeMalIds = [
      ...new Set(
        rels
          .filter((rel) => /adaptation/i.test(rel.relation))
          .flatMap((rel) => (rel.entry ?? []).filter((e) => e.type === "anime").map((e) => e.mal_id))
          .filter(Boolean),
      ),
    ];
    await sleep(700); // Jikan rate limit
    if (animeMalIds.length === 0) continue;

    const animes = (await sql`select id from titles where kind = 'anime' and mal_id in ${sql(animeMalIds)}`) as { id: string }[];
    if (animes.length === 0) continue;

    // franchise key = the manga's own id (stable, unique per manga)
    const ids = [m.id, ...animes.map((a) => a.id)];
    await sql`update titles set series_id = ${m.id} where id in ${sql(ids)}`;
    linked++;
    if (linked % 20 === 0) console.log(`  …linked ${linked}`);
  }

  console.log(`✓ Linked ${linked} manga to their anime adaptations.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
