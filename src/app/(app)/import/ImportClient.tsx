"use client";

import { useState } from "react";
import Link from "next/link";
import { importAniListAction, importMalAction } from "./actions";
import type { ImportSummary } from "@/lib/importList";

type Source = "anilist" | "mal";
type Result = { ok: true; summary: ImportSummary } | { ok: false; error: string };

export function ImportClient() {
  const [source, setSource] = useState<Source>("anilist");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const runAniList = async () => {
    if (busy || !username.trim()) return;
    setBusy(true); setResult(null);
    try { setResult(await importAniListAction(username)); }
    catch { setResult({ ok: false, error: "Something went wrong — please try again." }); }
    finally { setBusy(false); }
  };
  const runMal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || busy) return;
    setBusy(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      setResult(await importMalAction(fd));
    } catch { setResult({ ok: false, error: "Something went wrong reading that file." }); }
    finally { setBusy(false); }
  };

  return (
    <div className="import">
      <div className="import__tabs" role="tablist" aria-label="Import source">
        <button role="tab" aria-selected={source === "anilist"} className={"import__tab" + (source === "anilist" ? " on" : "")} onClick={() => { setSource("anilist"); setResult(null); }}>AniList</button>
        <button role="tab" aria-selected={source === "mal"} className={"import__tab" + (source === "mal" ? " on" : "")} onClick={() => { setSource("mal"); setResult(null); }}>MyAnimeList</button>
      </div>

      {source === "anilist" ? (
        <div className="import__panel">
          <label className="import__label" htmlFor="al-user">Your AniList username</label>
          <div className="import__row">
            <input
              id="al-user"
              className="import__input"
              value={username}
              placeholder="e.g. yourname"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runAniList(); }}
              disabled={busy}
            />
            <button className="btn btn--primary" onClick={runAniList} disabled={busy || !username.trim()}>
              {busy ? "Importing…" : "Import my list"}
            </button>
          </div>
          <p className="import__hint">
            Public AniList lists only. We match by title, add them to a new <b>Imported from AniList</b> list, and bring over your status &amp; scores.
          </p>
        </div>
      ) : (
        <div className="import__panel">
          <label className="import__label">Upload your MAL export</label>
          <label className={"import__drop" + (busy ? " import__drop--busy" : "")}>
            <input type="file" accept=".xml,.gz,application/gzip,application/x-gzip,text/xml" hidden onChange={runMal} disabled={busy} />
            <span className="import__drop-ico" aria-hidden="true">↑</span>
            <span className="import__drop-txt">{busy ? "Importing…" : "Choose your list export file (.xml or .xml.gz)"}</span>
          </label>
          <p className="import__hint">
            In MyAnimeList: <b>Profile → List → Export</b> (anime and/or manga). Upload the file it gives you — we match by title into a new <b>Imported from MyAnimeList</b> list.
          </p>
        </div>
      )}

      {result && (
        result.ok ? (
          <ResultCard s={result.summary} />
        ) : (
          <div className="import__err">{result.error}</div>
        )
      )}
    </div>
  );
}

function ResultCard({ s }: { s: ImportSummary }) {
  return (
    <div className="import__result">
      <div className="import__result-head">
        <span className="import__result-big">{s.imported}</span>
        <span className="import__result-lbl">title{s.imported === 1 ? "" : "s"} imported</span>
      </div>
      <ul className="import__stats">
        <li><b>{s.matched}</b> matched in our catalog{s.total ? ` of ${s.total}` : ""}</li>
        {s.duplicates > 0 && <li><b>{s.duplicates}</b> already in your list (skipped)</li>}
        {s.unmatched > 0 && <li className="import__stat--muted"><b>{s.unmatched}</b> not in our catalog yet</li>}
      </ul>
      {s.imported > 0 && s.listId ? (
        <div className="import__result-actions">
          <Link className="btn btn--primary" href={`/watchlist/${encodeURIComponent(s.listId)}`}>Open “{s.listTitle}” →</Link>
          <Link className="btn" href="/profile">See your stats</Link>
        </div>
      ) : s.matched === 0 ? (
        <p className="import__hint">None of those titles are in our catalog yet — nothing was added.</p>
      ) : (
        <p className="import__hint">Everything was already in your list — nothing new to add.</p>
      )}
    </div>
  );
}
