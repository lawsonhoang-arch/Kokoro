"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { importAniListAction, importMalAction, importListFileAction } from "./actions";
import type { ImportSummary } from "@/lib/importList";
import type { KokoroImportResult } from "@/lib/importKokoro";

type Source = "anilist" | "mal" | "kokoro" | "notes";
type Result = { ok: true; summary: ImportSummary } | { ok: false; error: string };

export function ImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [source, setSource] = useState<Source>("anilist");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [koResult, setKoResult] = useState<KokoroImportResult | null>(null);

  const pick = (s: Source) => { setSource(s); setResult(null); setKoResult(null); };
  const succeeded = () => router.refresh(); // update the gallery behind the modal

  const runAniList = async () => {
    if (busy || !username.trim()) return;
    setBusy(true); setResult(null);
    try {
      const r = await importAniListAction(username);
      setResult(r);
      if (r.ok) succeeded();
    } catch { setResult({ ok: false, error: "Something went wrong — please try again." }); }
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
      const r = await importMalAction(fd);
      setResult(r);
      if (r.ok) succeeded();
    } catch { setResult({ ok: false, error: "Something went wrong reading that file." }); }
    finally { setBusy(false); }
  };
  const runKokoro = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || busy) return;
    setBusy(true); setKoResult(null);
    try {
      const r = await importListFileAction(await f.text());
      setKoResult(r);
      if (r.ok) succeeded();
    } catch { setKoResult({ ok: false, error: "Couldn't read that file." }); }
    finally { setBusy(false); }
  };

  return (
    <div className="wl-modal on" role="dialog" aria-modal="true" aria-labelledby="imp-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wl-modal__box wl-modal__box--import">
        <div className="wl-modal__head">
          <h3 className="wl-modal__title" id="imp-title">Import a list</h3>
          <button className="wl-modal__x" type="button" aria-label="Close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="import">
          <div className="import__tabs" role="tablist" aria-label="Import source">
            <button role="tab" aria-selected={source === "anilist"} className={"import__tab" + (source === "anilist" ? " on" : "")} onClick={() => pick("anilist")}>AniList</button>
            <button role="tab" aria-selected={source === "mal"} className={"import__tab" + (source === "mal" ? " on" : "")} onClick={() => pick("mal")}>MyAnimeList</button>
            <button role="tab" aria-selected={source === "kokoro"} className={"import__tab" + (source === "kokoro" ? " on" : "")} onClick={() => pick("kokoro")}>Kokoro file</button>
            <button role="tab" aria-selected={source === "notes"} className={"import__tab" + (source === "notes" ? " on" : "")} onClick={() => pick("notes")}>From notes</button>
          </div>

          {source === "notes" ? (
            <div className="import__panel">
              <label className="import__label">Paste a written list</label>
              <p className="import__hint" style={{ marginTop: 0 }}>
                Have a list jotted in your notes, a doc, or a message? Paste it in and we&apos;ll pull
                out the titles, match them to the catalogue, and let you check the grid — plus
                search-add anything we miss — before it becomes a list.
              </p>
              <Link className="btn btn--primary" href="/watchlist/build" onClick={onClose} style={{ marginTop: 4 }}>
                Open the builder →
              </Link>
            </div>
          ) : source === "anilist" ? (
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
          ) : source === "mal" ? (
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
          ) : (
            <div className="import__panel">
              <label className="import__label">Restore a Kokoro export</label>
              <label className={"import__drop" + (busy ? " import__drop--busy" : "")}>
                <input type="file" accept="application/json,.json" hidden onChange={runKokoro} disabled={busy} />
                <span className="import__drop-ico" aria-hidden="true">↑</span>
                <span className="import__drop-txt">{busy ? "Importing…" : "Choose a Kokoro export file (.json)"}</span>
              </label>
              <p className="import__hint">
                The <b>.json</b> you downloaded from a list&apos;s <b>⋯ → Export</b>. It rebuilds the list(s) exactly — status, scores, aspect ratings, progress and notes — matched by our catalog.
              </p>
            </div>
          )}

          {result && (result.ok ? <ResultCard s={result.summary} onGo={onClose} /> : <div className="import__err">{result.error}</div>)}
          {koResult && (koResult.ok ? <KoResultCard r={koResult} onGo={onClose} /> : <div className="import__err">{koResult.error}</div>)}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ s, onGo }: { s: ImportSummary; onGo: () => void }) {
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
          <Link className="btn btn--primary" href={`/watchlist/${encodeURIComponent(s.listId)}`} onClick={onGo}>Open “{s.listTitle}” →</Link>
          <button className="btn" type="button" onClick={onGo}>Done</button>
        </div>
      ) : s.matched === 0 ? (
        <p className="import__hint">None of those titles are in our catalog yet — nothing was added.</p>
      ) : (
        <p className="import__hint">Everything was already in your list — nothing new to add.</p>
      )}
    </div>
  );
}

function KoResultCard({ r, onGo }: { r: Extract<KokoroImportResult, { ok: true }>; onGo: () => void }) {
  const first = r.lists[0];
  return (
    <div className="import__result">
      <div className="import__result-head">
        <span className="import__result-big">{r.imported}</span>
        <span className="import__result-lbl">title{r.imported === 1 ? "" : "s"} imported</span>
      </div>
      <ul className="import__stats">
        <li>into <b>{r.lists.length}</b> new {r.lists.length === 1 ? "list" : "lists"}</li>
        {r.unmatched > 0 && <li className="import__stat--muted"><b>{r.unmatched}</b> not in our catalog yet</li>}
      </ul>
      <div className="import__result-actions">
        {first && <Link className="btn btn--primary" href={`/watchlist/${encodeURIComponent(first.id)}`} onClick={onGo}>Open “{first.title}” →</Link>}
        <button className="btn" type="button" onClick={onGo}>Done</button>
      </div>
    </div>
  );
}
