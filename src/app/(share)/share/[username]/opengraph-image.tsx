import { ImageResponse } from "next/og";
import { getUserIdByUsername, getProfileUser, getProfileSummary } from "@/lib/profile";
import { getFavorites } from "@/lib/favorites";

export const runtime = "nodejs"; // needs the DB (postgres.js)
export const revalidate = 3600; // cache the generated card for an hour
export const alt = "A taste recap on Kokoro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Palette (literals — Satori can't read CSS custom properties)
const C = {
  bg1: "#17130d", bg2: "#221a11", surface: "#2a221b", line: "#3b322a",
  ink: "#efe9e0", inkSoft: "#c6bcb1", inkFaint: "#948a7f",
  accent: "#e0864a", accentInk: "#241206",
};

// Fetch a cover as a data URI so a slow/failed image degrades to a gradient
// instead of breaking the whole card. Small + bounded.
async function coverUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 170_000) return null; // keep the card light
    const mime = res.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function grad(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const a = Math.abs(h) % 360;
  // hsl (not oklch) — safest for Satori's colour parser
  return `linear-gradient(135deg, hsl(${a} 42% 44%), hsl(${(a + 40) % 360} 42% 30%))`;
}

export default async function OgImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const userId = await getUserIdByUsername(decodeURIComponent(username));

  let name = "A reader";
  let handle = username;
  let stats: { v: string; l: string }[] = [];
  let covers: { uri: string | null; seed: string }[] = [];
  let tasteGenre: string | null = null;

  if (userId) {
    const [user, summary, favorites] = await Promise.all([
      getProfileUser(userId),
      getProfileSummary(userId),
      getFavorites(userId),
    ]);
    if (user) {
      name = user.name || "@" + user.username;
      handle = user.username;
    }
    const s = summary.stats;
    tasteGenre = s.topGenre;
    stats = [
      { v: s.completed.toLocaleString(), l: "completed" },
      { v: s.hours.toLocaleString(), l: "hours" },
      { v: s.episodesWatched.toLocaleString(), l: "episodes" },
    ];
    const picks = favorites.slice(0, 4);
    covers = await Promise.all(picks.map(async (t) => ({ uri: await coverUri(t.cover), seed: t.id })));
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          padding: "60px 64px", color: C.ink,
          backgroundImage: `linear-gradient(150deg, ${C.bg1}, ${C.bg2})`,
          fontFamily: "sans-serif",
        }}
      >
        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>
            kokoro<span style={{ color: C.accent }}>.</span>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: C.inkFaint }}>anime &amp; manga, your way</div>
        </div>

        {/* main */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 48, marginTop: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 24, color: C.accent, fontWeight: 700 }}>ON KOKORO</div>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05, marginTop: 6 }}>{name}</div>
            <div style={{ display: "flex", fontSize: 26, color: C.inkFaint, marginTop: 4 }}>@{handle}</div>

            <div style={{ display: "flex", gap: 14, marginTop: 34 }}>
              {stats.map((st) => (
                <div key={st.l} style={{ display: "flex", flexDirection: "column", padding: "14px 20px", borderRadius: 16, background: C.surface, border: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>{st.v}</div>
                  <div style={{ display: "flex", fontSize: 17, color: C.inkFaint, textTransform: "uppercase", letterSpacing: 1 }}>{st.l}</div>
                </div>
              ))}
            </div>
            {tasteGenre && (
              <div style={{ display: "flex", fontSize: 24, color: C.inkSoft, marginTop: 24 }}>Most at home in {tasteGenre.toLowerCase()}.</div>
            )}
          </div>

          {/* favourite covers */}
          {covers.length > 0 && (
            <div style={{ display: "flex", gap: 14 }}>
              {covers.map((c, i) => (
                <div key={i} style={{ display: "flex", width: 150, height: 214, borderRadius: 14, overflow: "hidden", border: `1px solid ${C.line}`, backgroundImage: c.uri ? undefined : grad(c.seed), transform: `translateY(${i % 2 ? 14 : -6}px)` }}>
                  {c.uri && (
                    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                    <img src={c.uri} width={150} height={214} style={{ objectFit: "cover" }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* footer CTA */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
          <div style={{ display: "flex", fontSize: 26, color: C.inkSoft }}>See my taste — and build your own.</div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: C.accentInk, background: C.accent, padding: "12px 26px", borderRadius: 100 }}>Join free at Kokoro →</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
