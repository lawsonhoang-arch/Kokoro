"use client";

import { useEffect, useRef, useState } from "react";
import { getTitleJournalAction, addTitleTakeAction, updateTitleTakeAction } from "@/app/(app)/journal/actions";
import type { JournalEntry } from "@/lib/journal";
import { Ico } from "./Ico";

// The watchlist detail's "your take" — overall notes about the title, stored as
// journal is_take entries. Shows the most recent (editable, autosaved), with
// "+ New take" to start another. To avoid losing a note when you navigate away
// (e.g. to the Journal), the save fires on blur and on unmount, not only on the
// debounce. The current text is mirrored to the watchlist `take` field (onMirror)
// so the card preview stays in sync.
export function TakeNotes({
  titleId,
  initialTake,
  onMirror,
}: {
  titleId: string;
  initialTake: string;
  onMirror: (body: string) => void;
}) {
  const [takes, setTakes] = useState<JournalEntry[]>([]);
  const [body, setBody] = useState(initialTake);
  const [saving, setSaving] = useState(false);
  const currentId = useRef<string | null>(null);
  const bodyRef = useRef(initialTake);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getTitleJournalAction(titleId)
      .then((es) => {
        if (cancelled) return;
        const ts = es.filter((e) => e.isTake); // newest-first
        setTakes(ts);
        if (touched.current) return; // user already editing — don't clobber
        if (ts.length) { currentId.current = ts[0].id; bodyRef.current = ts[0].body; setBody(ts[0].body); }
        else { currentId.current = null; bodyRef.current = initialTake; setBody(initialTake); }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // initialTake seeds the box before the load resolves; not a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleId]);

  const commit = async () => {
    if (!dirty.current) return;
    dirty.current = false;
    const text = bodyRef.current;
    setSaving(true);
    try {
      if (currentId.current) {
        const id = currentId.current;
        await updateTitleTakeAction(id, text);
        setTakes((ts) => ts.map((t) => (t.id === id ? { ...t, body: text } : t)));
      } else if (text.trim()) {
        const e = await addTitleTakeAction(titleId, text);
        if (e) { currentId.current = e.id; setTakes((ts) => [e, ...ts]); }
      }
    } catch {
      dirty.current = true; // let a later flush retry
    } finally {
      setSaving(false);
    }
  };

  // flush the pending save when the panel/component unmounts (e.g. you navigate
  // to the Journal) so the note is never lost to the debounce.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    void commit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (text: string) => {
    touched.current = true;
    dirty.current = true;
    bodyRef.current = text;
    setBody(text);
    onMirror(text); // live mirror to the watchlist take (card preview)
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void commit(), 600);
  };

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    void commit();
  };

  const newTake = () => {
    if (timer.current) clearTimeout(timer.current);
    void commit(); // save the current take before starting a fresh one
    touched.current = true;
    dirty.current = false;
    currentId.current = null;
    bodyRef.current = "";
    setBody("");
    onMirror("");
  };

  const count = takes.length;
  return (
    <>
      <textarea
        className="k-take"
        value={body}
        placeholder="What did it make you feel? Write as much or as little as you like…"
        onChange={(e) => onChange(e.target.value)}
        onBlur={flush}
      />
      <div className="k-take-foot">
        <span className="k-privacy">
          <Ico name="lock" s={11} /> Private
        </span>
        <button type="button" className="k-take-new" onClick={newTake} title="Start a fresh take">
          ＋ New take
        </button>
        <span className="k-take-meta">
          {saving
            ? "Saving…"
            : count > 0
              ? `${count} take${count > 1 ? "s" : ""} · in your Journal`
              : "Saved to your Journal"}
        </span>
      </div>
    </>
  );
}
