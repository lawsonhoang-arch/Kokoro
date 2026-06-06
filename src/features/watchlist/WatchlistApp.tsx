"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
} from "react";
import { flushSync } from "react-dom";

import {
  TOKENS,
  CAT_LABEL,
  bucketOf,
  chainedComparator,
} from "./rules";
import { updateEntryAction, removeEntryAction } from "@/app/(app)/watchlist/actions";
import { hueValue, type HueKey } from "@/lib/palette";

import { EntryRow } from "./EntryRow";
import { EntryCard } from "./EntryCard";
import { GroupCard, RuleChip } from "./GroupCard";
import { DetailPanel } from "./DetailPanel";
import { SculptSidebar, Segmented } from "./SculptSidebar";
import { LayoutPanel } from "./LayoutPanel";
import { Ico } from "./Ico";

import {
  emptyRules,
  type Entry,
  type Feeling,
  type Group,
  type LayoutMode,
  type Mode,
  type PaintState,
  type PanelCfg,
  type Rect,
  type RuleCat,
  type Rules,
  type Status,
  type ViewMode,
  type Bucket,
} from "./types";

// Fixed presentation tweaks (the prototype's dev-only TweaksPanel is omitted —
// the accent comes from the opened watchlist's hue).
const GLYPH_SET = "orbs" as const;
const DIRECTION = "paper";
const DENSITY = "regular";

const VIEW_KEY = "kokoro_view";
const LAYOUT_KEY = "kokoro_layout_mode";
const PANELS_KEY = "kokoro_panels_v2";
const SIDEBAR_KEY = "kokoro_sidebar_collapsed";

let _gid = 1;
const nid = () => "g" + _gid++;

const startViewTransition = (apply: () => void) => {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => {
      ready?: Promise<unknown>;
      finished?: Promise<unknown>;
    };
  };
  if (typeof document !== "undefined" && doc.startViewTransition) {
    const t = doc.startViewTransition(apply);
    // a transition interrupted by a newer one rejects with AbortError — ignore it
    t?.ready?.catch(() => {});
    t?.finished?.catch(() => {});
  } else {
    apply();
  }
};

type Section = { key: string; label: string | null; items: Entry[]; order?: number };
type TabObj = { key: string; label: string; group?: Group; items: Entry[] };
type ArmedTarget = { type: "globals" } | { type: "group" | "entry"; id: string } | null;
type BrowseHit =
  | { kind: "coll"; id: string }
  | { kind: "status"; status: string }
  | null;

export default function WatchlistApp({
  id,
  title,
  hue,
  initialEntries,
}: {
  id: string;
  title: string;
  hue: HueKey;
  initialEntries: Entry[];
}) {
  // Title + accent come from the owning list record (fetched server-side).
  const accent = hueValue(hue);
  const wlTitle = title || "My list";

  // Page-scope class: the watchlist-page.css overrides (full-height app, solid
  // nav, no body vignette) apply only while this class is on <body>.
  useEffect(() => {
    document.body.classList.add("kk-watchlist-route");
    return () => document.body.classList.remove("kk-watchlist-route");
  }, []);

  const [mode, setMode] = useState<Mode>("browse");
  const [entries, setEntries] = useState<Entry[]>(() =>
    initialEntries.map((e) => ({ ...e, dims: { ...e.dims } })),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Esc closes the detail modal
  useEffect(() => {
    if (selectedId == null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selectedId]);

  const [showScore] = useState(false);
  const [query, setQuery] = useState("");
  const [tabbed, setTabbed] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("list");

  const chooseTab = (key: string) => {
    if (key === activeTab) return;
    startViewTransition(() => flushSync(() => setActiveTab(key)));
  };

  const [convKind, setConvKind] = useState<"heading" | "tab" | null>(null);
  const [convArmed, setConvArmed] = useState(false);
  const [convZone, setConvZone] = useState<"rail" | "list" | "coll" | null>(null);
  const [convTarget, setConvTarget] = useState<string | null>(null);

  const [globals, setGlobals] = useState<Rules>(emptyRules);
  const [groups, setGroups] = useState<Group[]>([]);
  const [paintOver, setPaintOver] = useState<Record<string, { color?: string; tags: string[] }>>({});
  const [paint, setPaint] = useState<PaintState>(null);
  const [armed, setArmed] = useState<ArmedTarget>(null);
  const [renamingTab, setRenamingTab] = useState<string | null>(null);
  const [tabDelTarget, setTabDelTarget] = useState<{ gid: string; key: string; label: string; count: number } | null>(null);

  const [listView, setListView] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as ViewMode) || "list";
    } catch {
      return "list";
    }
  });
  const chooseView = (v: ViewMode) => {
    startViewTransition(() => {
      flushSync(() => setListView(v));
      try {
        localStorage.setItem(VIEW_KEY, v);
      } catch {}
    });
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleSidebar = () =>
    setSidebarCollapsed((v) => {
      const n = !v;
      try {
        localStorage.setItem(SIDEBAR_KEY, n ? "1" : "0");
      } catch {}
      return n;
    });

  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    try {
      return (localStorage.getItem(LAYOUT_KEY) as LayoutMode) || "stack";
    } catch {
      return "stack";
    }
  });
  const chooseLayout = (m: LayoutMode) => {
    startViewTransition(() => {
      flushSync(() => setLayoutMode(m));
      try {
        localStorage.setItem(LAYOUT_KEY, m);
      } catch {}
    });
  };

  const [panelCfg, setPanelCfg] = useState<PanelCfg>(() => {
    try {
      return JSON.parse(localStorage.getItem(PANELS_KEY) || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PANELS_KEY, JSON.stringify(panelCfg));
    } catch {}
  }, [panelCfg]);
  const resetLayout = () => setPanelCfg({});

  // measure the canvas so default packing stays responsive
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [canvasW, setCanvasW] = useState(960);
  const attachCanvas = (el: HTMLDivElement | null) => {
    canvasRef.current = el;
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (el) {
      const ro = new ResizeObserver((ents) => {
        const w = ents[0].contentRect.width;
        setCanvasW((p) => (Math.abs(p - w) > 1 ? w : p));
      });
      ro.observe(el);
      roRef.current = ro;
      setCanvasW(el.getBoundingClientRect().width);
    }
  };
  const zTop = useRef(20);
  const defaultsRef = useRef<PanelCfg>({});
  const seedRef = useRef(1);

  /* ----------------------- rule mutations ----------------------- */
  const addGlobalRule = (cat: RuleCat, key: string) =>
    setGlobals((g) => {
      if (cat === "sort" && key === "random") seedRef.current++;
      return { ...g, [cat]: g[cat].includes(key) ? g[cat] : [...g[cat], key] };
    });
  const removeGlobalRule = (cat: RuleCat, key: string) =>
    setGlobals((g) => ({ ...g, [cat]: g[cat].filter((k) => k !== key) }));

  const addGroupRule = (gid: string, cat: RuleCat, key: string) =>
    setGroups((gs) =>
      gs.map((g) =>
        g.id === gid
          ? { ...g, scoped: { ...g.scoped, [cat]: (g.scoped[cat] || []).includes(key) ? g.scoped[cat] : [...(g.scoped[cat] || []), key] } }
          : g,
      ),
    );
  const removeGroupRule = (gid: string, cat: RuleCat, key: string) =>
    setGroups((gs) =>
      gs.map((g) => (g.id === gid ? { ...g, scoped: { ...g.scoped, [cat]: (g.scoped[cat] || []).filter((k) => k !== key) } } : g)),
    );
  const renameGroup = (gid: string, name: string) =>
    setGroups((gs) => gs.map((g) => (g.id === gid ? { ...g, name: name || "Untitled group" } : g)));
  const dissolveGroup = (gid: string) => setGroups((gs) => gs.filter((g) => g.id !== gid));

  const removeFromGroups = (gs: Group[], id: string) =>
    gs.map((g) => ({ ...g, entryIds: g.entryIds.filter((x) => x !== id) })).filter((g) => g.entryIds.length > 0);

  const mergeOnto = (dragId: string, targetId: string) => {
    if (dragId === targetId) return;
    setGroups((gs) => {
      const targetGroup = gs.find((g) => g.entryIds.includes(targetId));
      let next = removeFromGroups(gs, dragId);
      if (targetGroup) {
        next = next.map((g) => (g.id === targetGroup.id ? { ...g, entryIds: [...g.entryIds, dragId] } : g));
      } else {
        next = [
          ...next,
          { id: nid(), name: "New group", entryIds: [targetId, dragId], parentId: null, scoped: emptyRules() },
        ];
      }
      return next;
    });
  };
  const addToGroup = (dragId: string, gid: string) =>
    setGroups((gs) => {
      if (gs.find((g) => g.id === gid && g.entryIds.includes(dragId))) return gs;
      return gs.map((g) => {
        let ids = g.entryIds.filter((x) => x !== dragId);
        if (g.id === gid) ids = [...ids, dragId];
        return { ...g, entryIds: ids };
      });
    });

  const removeFromCollection = (id: string) =>
    setGroups((gs) => gs.map((g) => ({ ...g, entryIds: g.entryIds.filter((x) => x !== id) })));

  // Remove a title from the watchlist entirely (deletes the entry + its rating/
  // notes from the DB, and cleans it out of local state + any collection).
  const removeEntryFromList = (id: string) => {
    setEntries((es) => es.filter((e) => e.id !== id));
    setGroups((gs) => removeFromGroups(gs, id));
    setPaintOver((po) => {
      const next = { ...po };
      delete next[id];
      return next;
    });
    setSelectedId((cur) => (cur === id ? null : cur));
    void removeEntryAction(id).catch(() => {});
  };

  // Persist a per-entry change to the DB (fire-and-forget; local state stays
  // the source of truth for the snappy UI).
  const persist = (entryId: string, patch: Parameters<typeof updateEntryAction>[1]) => {
    void updateEntryAction(entryId, patch).catch(() => {});
  };
  const takeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const STATUS_OK: Record<string, number> = { watching: 1, completed: 1, planned: 1 };
  const setEntryStatus = (id: string, status: string) => {
    if (!STATUS_OK[status]) return;
    const cur = entries.find((e) => e.id === id);
    if (!cur) return;
    const patch: { status: Status; progress?: number } = { status: status as Status };
    if (status === "planned") patch.progress = 0;
    else if (status === "completed") patch.progress = cur.episodes;
    else if (status === "watching" && (cur.progress == null || cur.progress >= cur.episodes))
      patch.progress = Math.max(1, Math.floor(cur.episodes / 4));
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    persist(id, patch);
  };
  const bumpEpisode = (id: string) => {
    const cur = entries.find((e) => e.id === id);
    if (!cur || cur.episodes <= 0) return;
    const nextEp = Math.min((cur.progress || 0) + 1, cur.episodes);
    const patch =
      nextEp >= cur.episodes
        ? { progress: nextEp, status: "completed" as Status }
        : { progress: nextEp };
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    persist(id, patch);
  };

  const createTab = (withId: string | null) => {
    const gid = nid();
    setGroups((gs) => {
      const next = withId ? gs.map((g) => ({ ...g, entryIds: g.entryIds.filter((x) => x !== withId) })) : gs;
      return [...next, { id: gid, name: "New collection", entryIds: withId ? [withId] : [], parentId: null, scoped: emptyRules() }];
    });
    setTabbed((tt) => [...tt, "g:" + gid]);
    setActiveTab("g:" + gid);
    setRenamingTab("g:" + gid);
  };
  const isGroupKey = (k: unknown): k is string => typeof k === "string" && k.startsWith("g:");
  const renameTabByKey = (key: string, name: string) => {
    if (isGroupKey(key)) renameGroup(key.slice(2), name);
  };

  /* ----------------------- impression edits ----------------------- */
  const upd = (id: string, patch: Partial<Entry>) =>
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const setFeeling = (id: string, f: Feeling | null) => {
    upd(id, { feeling: f });
    persist(id, { feeling: f });
  };
  const setDim = (id: string, d: keyof Entry["dims"], v: number) => {
    const cur = entries.find((e) => e.id === id);
    if (!cur) return;
    const dims = { ...cur.dims, [d]: v };
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, dims } : e)));
    persist(id, { dims });
  };
  const setTake = (id: string, v: string) => {
    upd(id, { take: v });
    clearTimeout(takeTimers.current[id]);
    takeTimers.current[id] = setTimeout(() => persist(id, { take: v }), 600);
  };

  /* ----------------------- paint ----------------------- */
  const applyPaint = (id: string) => {
    if (!paint) return;
    setPaintOver((po) => {
      const cur = po[id] || { color: undefined, tags: [] };
      if (paint.cat === "color") return { ...po, [id]: { ...cur, color: paint.key } };
      const tags = cur.tags.includes(paint.key) ? cur.tags : [...cur.tags, paint.key];
      return { ...po, [id]: { ...cur, tags } };
    });
  };

  /* ----------------------- drag controllers ----------------------- */
  type Ghost = { el: HTMLElement; w: number; h: number; ox: number; oy: number };
  type DragState = {
    kind: "entry" | "group" | "token";
    id?: string;
    cat?: RuleCat;
    key?: string;
    srcEl: HTMLElement;
    sx: number;
    sy: number;
    started: boolean;
    ghost: Ghost | null;
  };
  const drag = useRef<DragState | null>(null);
  const stroke = useRef<Set<string> | null>(null);
  const conv = useRef<{ kind: "heading" | "tab"; key: string; label: string; sx: number; sy: number; started: boolean; ghost: HTMLElement | null } | null>(null);

  const findTarget = (x: number, y: number, kind: "token" | "entry", excludeId?: string): ArmedTarget => {
    let el = document.elementFromPoint(x, y) as HTMLElement | null;
    while (el && el !== document.body) {
      const d = el.dataset || {};
      if (kind === "token") {
        if (d.drop === "globals") return { type: "globals" };
        if (d.groupId) return { type: "group", id: d.groupId };
      } else if (kind === "entry") {
        if (d.entryId && d.entryId !== excludeId) return { type: "entry", id: d.entryId };
        if (d.groupId) return { type: "group", id: d.groupId };
      }
      el = el.parentElement;
    }
    return null;
  };

  const makeGhost = (srcEl: HTMLElement): Ghost => {
    const g = srcEl.cloneNode(true) as HTMLElement;
    g.classList.add("k-ghost");
    const r = srcEl.getBoundingClientRect();
    g.style.width = r.width + "px";
    g.style.left = "0px";
    g.style.top = "0px";
    g.dataset.ghost = "1";
    document.body.appendChild(g);
    return { el: g, w: r.width, h: r.height, ox: r.width / 2, oy: r.height / 2 };
  };

  /* ---- browse-mode: drag an entry onto a tab or collection heading ---- */
  const browseDrag = useRef<{ id: string; sx: number; sy: number; started: boolean; label: string; ghost?: HTMLElement } | null>(null);
  const [browseArm, setBrowseArm] = useState<BrowseHit>(null);
  const dropHitAt = (x: number, y: number): BrowseHit => {
    let el = document.elementFromPoint(x, y) as HTMLElement | null;
    while (el && el !== document.body) {
      if (el.dataset && el.dataset.tabKey) {
        const tk = el.dataset.tabKey;
        if (tk.startsWith("g:")) return { kind: "coll", id: tk.slice(2) };
        if (tk.startsWith("s:")) return { kind: "status", status: tk.slice(2) };
      }
      if (el.dataset && el.dataset.collid) return { kind: "coll", id: el.dataset.collid };
      if (el.dataset && el.dataset.statusKey) return { kind: "status", status: el.dataset.statusKey };
      el = el.parentElement;
    }
    return null;
  };
  const onEntryBrowse = (e: RPointerEvent, id: string) => {
    if (sculpt) return;
    if (e.button != null && e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".k-addwrap, .k-addmenu, button, input, textarea, a")) return;
    const entry = byId[id];
    browseDrag.current = { id, sx: e.clientX, sy: e.clientY, started: false, label: entry ? entry.title : "" };
    window.addEventListener("pointermove", onEntryBrowseMove);
    window.addEventListener("pointerup", onEntryBrowseUp);
  };
  const onEntryBrowseMove = (e: PointerEvent) => {
    const d = browseDrag.current;
    if (!d) return;
    if (!d.started) {
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 8) return;
      d.started = true;
      document.body.classList.add("k-entry-dragging");
      const g = document.createElement("div");
      g.className = "k-entrydrag-ghost";
      g.textContent = d.label || "Untitled";
      document.body.appendChild(g);
      d.ghost = g;
    }
    if (d.ghost) d.ghost.style.transform = `translate(${e.clientX + 14}px, ${e.clientY - 18}px)`;
    const hit = dropHitAt(e.clientX, e.clientY);
    setBrowseArm(hit);
    if (d.ghost) d.ghost.classList.toggle("on", !!hit);
  };
  const onEntryBrowseUp = (e: PointerEvent) => {
    window.removeEventListener("pointermove", onEntryBrowseMove);
    window.removeEventListener("pointerup", onEntryBrowseUp);
    document.body.classList.remove("k-entry-dragging");
    const d = browseDrag.current;
    browseDrag.current = null;
    setBrowseArm(null);
    if (d && d.ghost) d.ghost.remove();
    if (!d) return;
    if (!d.started) {
      setSelectedId(d.id);
      return;
    }
    const hit = dropHitAt(e.clientX, e.clientY);
    if (!hit) return;
    if (hit.kind === "coll") addToGroup(d.id, hit.id);
    else if (hit.kind === "status") setEntryStatus(d.id, hit.status);
  };

  const onGrabEntry = (e: RPointerEvent, id: string) => {
    if (e.button != null && e.button !== 0) return;
    if (paint) {
      e.preventDefault();
      stroke.current = new Set();
      stroke.current.add(id);
      applyPaint(id);
      flashPaint(id);
      const move = (ev: PointerEvent) => {
        const tEl = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
        let n = tEl;
        while (n && n !== document.body) {
          if (n.dataset && n.dataset.entryId) break;
          n = n.parentElement;
        }
        if (n && n.dataset && n.dataset.entryId && !stroke.current!.has(n.dataset.entryId)) {
          stroke.current!.add(n.dataset.entryId);
          applyPaint(n.dataset.entryId);
          flashPaint(n.dataset.entryId);
        }
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        stroke.current = null;
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return;
    }
    startDrag(e, { kind: "entry", id, srcEl: e.currentTarget as HTMLElement });
  };
  const onGrabToken = (e: RPointerEvent, cat: RuleCat, key: string) => {
    if (paint) return;
    startDrag(e, { kind: "token", cat, key, srcEl: e.currentTarget as HTMLElement });
  };

  const startDrag = (e: RPointerEvent, info: { kind: "entry" | "token"; id?: string; cat?: RuleCat; key?: string; srcEl: HTMLElement }) => {
    e.preventDefault();
    drag.current = { ...info, sx: e.clientX, sy: e.clientY, started: false, ghost: null };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragUp);
  };

  const onDragMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.started) {
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 6) return;
      d.started = true;
      d.ghost = makeGhost(d.srcEl);
      document.body.style.cursor = "grabbing";
    }
    d.ghost!.el.style.transform = `translate(${e.clientX - d.ghost!.ox}px, ${e.clientY - d.ghost!.oy}px) rotate(-2deg) scale(1.02)`;
    const tgt = findTarget(e.clientX, e.clientY, d.kind === "token" ? "token" : "entry", d.id);
    setArmed((prev) => {
      const same = prev && tgt && prev.type === tgt.type && (prev as { id?: string }).id === (tgt as { id?: string }).id;
      const none = !prev && !tgt;
      return same || none ? prev : tgt;
    });
  };

  const onDragUp = (e: PointerEvent) => {
    const d = drag.current;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragUp);
    document.body.style.cursor = "";
    drag.current = null;
    setArmed(null);
    if (!d) return;
    if (d.ghost) d.ghost.el.remove();
    if (!d.started) return;
    const tgt = findTarget(e.clientX, e.clientY, d.kind === "token" ? "token" : "entry", d.id);
    if (!tgt) return;
    if (d.kind === "entry") {
      if (tgt.type === "entry") mergeOnto(d.id!, tgt.id);
      else if (tgt.type === "group") addToGroup(d.id!, tgt.id);
    } else if (d.kind === "token") {
      if (tgt.type === "globals") addGlobalRule(d.cat!, d.key!);
      else if (tgt.type === "group") addGroupRule(tgt.id, d.cat!, d.key!);
    }
  };

  const flashPaint = (id: string) => {
    const el = document.querySelector<HTMLElement>(`[data-entry-id="${id}"]`);
    if (el) {
      el.classList.remove("paint-hit");
      void el.offsetWidth;
      el.classList.add("paint-hit");
    }
  };

  /* ----------------------- effective rules ----------------------- */
  const effArr = (cat: RuleCat, grp: Group | null): string[] =>
    (grp && grp.scoped && grp.scoped[cat] && grp.scoped[cat].length ? grp.scoped[cat] : globals[cat]) || [];
  const effColor = (e: Entry, grp: Group | null): string | null => {
    const ov = paintOver[e.id];
    if (ov && ov.color !== undefined && ov.color !== null) return ov.color;
    const arr = effArr("color", grp);
    return arr.length ? arr[0] : null;
  };
  const effTags = (e: Entry, grp: Group | null): string[] => {
    const base = effArr("tag", grp);
    const ov = paintOver[e.id];
    const painted = ov && ov.tags ? ov.tags : [];
    return Array.from(new Set([...base, ...painted]));
  };
  const effSortKeys = (grp: Group | null) => effArr("sort", grp);

  /* ----------------------- derived list ----------------------- */
  const byId: Record<string, Entry> = {};
  entries.forEach((e) => (byId[e.id] = e));
  const groupedIds = new Set(groups.flatMap((g) => g.entryIds));
  const q = query.trim().toLowerCase();
  const matches = (e: Entry) =>
    !q || e.title.toLowerCase().includes(q) || e.genres.some((g) => g.toLowerCase().includes(q));

  const singles = entries.filter((e) => !groupedIds.has(e.id) && matches(e));
  const sortSingles = (arr: Entry[]) => {
    const cmp = chainedComparator(globals.sort, "s" + seedRef.current);
    return cmp ? [...arr].sort(cmp) : arr;
  };

  let sections: Section[] = [];
  const primaryGroup = globals.group[0] || null;
  if (primaryGroup) {
    const map: Record<string, Section & { order: number }> = {};
    singles.forEach((e) => {
      const b: Bucket = bucketOf(e, primaryGroup);
      (map[b.key] = map[b.key] || { key: b.key, label: b.label, order: b.order, items: [] }).items.push(e);
    });
    sections = Object.values(map).sort((a, b) => a.order - b.order || (a.label || "").localeCompare(b.label || ""));
    sections.forEach((s) => (s.items = sortSingles(s.items)));
  } else {
    sections = [{ key: "all", label: null, items: sortSingles(singles) }];
  }

  const selected = selectedId ? byId[selectedId] : null;
  const sculpt = mode === "sculpt";
  const effView = listView;
  const collections = groups.map((g) => ({ id: g.id, name: g.name }));

  const groupById: Record<string, Group> = {};
  groups.forEach((g) => (groupById[g.id] = g));
  const childrenOf = (pid: string | null) => groups.filter((g) => (g.parentId || null) === (pid || null));
  const collItemsSorted = (g: Group) =>
    [...g.entryIds]
      .map((id) => byId[id])
      .filter(Boolean)
      .sort((a, b) => {
        const c = chainedComparator(effSortKeys(g), "s" + seedRef.current);
        return c ? c(a, b) : 0;
      });
  const tabObjFor = (key: string): TabObj | null => {
    if (typeof key !== "string") return null;
    if (key.startsWith("g:")) {
      const g = groupById[key.slice(2)];
      return g ? { key, label: g.name, group: g, items: collItemsSorted(g) } : null;
    }
    if (key.startsWith("s:")) {
      const s = sections.find((ss) => "s:" + ss.key === key);
      return s ? { key, label: s.label || "All titles", items: s.items } : null;
    }
    return null;
  };
  const tabGroups = tabbed.map(tabObjFor).filter(Boolean) as TabObj[];
  const activeTabObj = activeTab !== "list" ? tabObjFor(activeTab) : null;
  const effectiveActive = activeTabObj ? activeTab : "list";
  const topColls = groups.filter((g) => !g.parentId && !tabbed.includes("g:" + g.id));
  const listSections = sections.filter((s) => s.items.length > 0 && !tabbed.includes("s:" + s.key));
  const sectionByKey: Record<string, Section> = {};
  sections.forEach((s) => (sectionByKey[s.key] = s));
  const panelKeys = [...topColls.map((g) => "g:" + g.id), ...listSections.map((s) => "s:" + s.key)];

  // ---- free-form layout geometry ----
  const estH = (key: string) => {
    let n = 0;
    if (key.startsWith("g:")) {
      const g = groupById[key.slice(2)];
      n = g ? g.entryIds.length : 0;
    } else {
      const s = sectionByKey[key.slice(2)];
      n = s ? s.items.length : 0;
    }
    return Math.max(200, Math.min(470, 150 + n * 46));
  };
  const computeDefaults = (keys: string[]): PanelCfg => {
    const gap = 16;
    const out: PanelCfg = {};
    if (keys.length === 0) return out;
    if (keys.length === 1) {
      const k = keys[0];
      out[k] = { x: 0, y: 0, w: Math.max(280, canvasW), h: estH(k), z: 1 };
      return out;
    }
    const cols = [0, 0];
    const colW = Math.max(248, Math.round((canvasW - gap) / 2));
    keys.forEach((k) => {
      const c = cols[0] <= cols[1] ? 0 : 1;
      const h = estH(k);
      out[k] = { x: c * (colW + gap), y: cols[c], w: colW, h, z: 1 };
      cols[c] += h + gap;
    });
    return out;
  };
  const layoutDefaults = computeDefaults(panelKeys);
  defaultsRef.current = layoutDefaults;
  const FALLBACK_RECT: Rect = { x: 0, y: 0, w: 300, h: 260, z: 1 };
  const rectOf = (key: string): Rect => panelCfg[key] || layoutDefaults[key] || FALLBACK_RECT;
  const setRect = (key: string, partial: Partial<Rect>) =>
    setPanelCfg((prev) => {
      const cur = prev[key] || defaultsRef.current[key] || FALLBACK_RECT;
      return { ...prev, [key]: { ...cur, ...partial } };
    });
  const bringFront = (key: string) =>
    setPanelCfg((prev) => {
      const cur = prev[key] || defaultsRef.current[key] || FALLBACK_RECT;
      const nextZ = ++zTop.current;
      return { ...prev, [key]: { ...cur, z: nextZ } };
    });
  const canvasH = panelKeys.reduce((m, k) => {
    const r = rectOf(k);
    return Math.max(m, r.y + r.h);
  }, 0) + 28;
  const gridLayout = layoutMode === "grid" && effectiveActive === "list";

  // nesting helpers
  const isDescendant = (childId: string, ancestorId: string) => {
    let cur: Group | undefined = groupById[childId];
    const seen = new Set<string>();
    while (cur && cur.parentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (cur.parentId === ancestorId) return true;
      cur = groupById[cur.parentId];
    }
    return false;
  };
  const canNest = (key: string, targetId: string | null) => {
    if (!isGroupKey(key) || !targetId) return false;
    const gid = key.slice(2);
    return gid !== targetId && !isDescendant(targetId, gid);
  };
  const setGroupParent = (gid: string, parentId: string | null) =>
    setGroups((gs) => gs.map((g) => (g.id === gid ? { ...g, parentId } : g)));

  /* ---- convert drag: pin / nest / unpin a collection ---- */
  const convZoneAt = (x: number, y: number): { zone: "rail" | "coll" | "list" | null; collId: string | null } => {
    let el = document.elementFromPoint(x, y) as HTMLElement | null;
    let collId: string | null = null;
    while (el && el !== document.body) {
      const c = el.classList;
      if (el.dataset && el.dataset.collid && collId == null) collId = el.dataset.collid;
      if (c && c.contains("k-tabsbar")) return { zone: "rail", collId: null };
      if (c && c.contains("k-scroll")) return { zone: collId ? "coll" : "list", collId };
      el = el.parentElement;
    }
    return { zone: null, collId: null };
  };
  const startConvDrag = (e: RPointerEvent, kind: "heading" | "tab", key: string, label: string) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    conv.current = { kind, key, label, sx: e.clientX, sy: e.clientY, started: false, ghost: null };
    window.addEventListener("pointermove", convMove);
    window.addEventListener("pointerup", convUp);
  };
  const convMove = (e: PointerEvent) => {
    const d = conv.current;
    if (!d) return;
    if (!d.started) {
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 6) return;
      d.started = true;
      setConvKind(d.kind);
      document.body.style.cursor = "grabbing";
      const g = document.createElement("div");
      g.className = "k-convert-ghost";
      g.textContent = d.label;
      document.body.appendChild(g);
      d.ghost = g;
    }
    if (d.ghost) d.ghost.style.transform = `translate(${e.clientX + 12}px, ${e.clientY - 14}px)`;
    const z = convZoneAt(e.clientX, e.clientY);
    let valid = false;
    if (z.zone === "rail") valid = true;
    else if (z.zone === "coll") valid = canNest(d.key, z.collId);
    else if (z.zone === "list") valid = true;
    setConvArmed(valid);
    setConvZone(valid ? z.zone : null);
    setConvTarget(valid && z.zone === "coll" ? z.collId : null);
  };
  const convUp = (e: PointerEvent) => {
    window.removeEventListener("pointermove", convMove);
    window.removeEventListener("pointerup", convUp);
    document.body.style.cursor = "";
    const d = conv.current;
    conv.current = null;
    setConvKind(null);
    setConvArmed(false);
    setConvZone(null);
    setConvTarget(null);
    if (!d) return;
    if (d.ghost) d.ghost.remove();
    if (!d.started) {
      if (d.kind === "tab") chooseTab(d.key);
      return;
    }
    const z = convZoneAt(e.clientX, e.clientY);
    const gid = isGroupKey(d.key) ? d.key.slice(2) : null;
    if (z.zone === "rail") {
      if (gid) setGroupParent(gid, null);
      setTabbed((t2) => (t2.includes(d.key) ? t2 : [...t2, d.key]));
      setActiveTab(d.key);
    } else if (z.zone === "coll" && canNest(d.key, z.collId)) {
      if (gid) setGroupParent(gid, z.collId);
      setTabbed((t2) => t2.filter((k) => k !== d.key));
      setActiveTab("list");
    } else if (z.zone === "list") {
      if (gid) setGroupParent(gid, null);
      setTabbed((t2) => t2.filter((k) => k !== d.key));
      setActiveTab("list");
    }
  };

  /* ----------------------- renderers ----------------------- */
  const renderEntry = (e: Entry, grp: Group | null) => {
    const common = {
      entry: e,
      colorKey: effColor(e, grp),
      tagKeys: effTags(e, grp),
      glyphSet: GLYPH_SET,
      showScore,
      selected: selectedId === e.id,
      onOpen: (eid: string) => setSelectedId(eid),
      collections,
      inGroupId: grp ? grp.id : null,
      onAddTab: addToGroup,
      onNewTab: createTab,
      onRemoveTab: removeFromCollection,
      onRemoveFromList: removeEntryFromList,
      onBrowseGrab: onEntryBrowse,
      onBumpEp: bumpEpisode,
    };
    if (effView === "list") return <EntryRow key={e.id} {...common} mode={mode} onGrab={onGrabEntry} />;
    return <EntryCard key={e.id} {...common} view={effView} />;
  };
  const renderList = (items: Entry[], grp: Group | null) => (
    <div className={effView === "cards" ? "k-cards" : "k-rows"}>{items.map((e) => renderEntry(e, grp))}</div>
  );
  const renderCollection = (g: Group): React.ReactNode => {
    const items = collItemsSorted(g);
    const kids = childrenOf(g.id);
    return (
      <GroupCard
        key={g.id}
        group={g}
        scoped={g.scoped}
        browse={!sculpt}
        armed={
          (!!armed && armed.type === "group" && armed.id === g.id) ||
          (!!browseArm && browseArm.kind === "coll" && browseArm.id === g.id)
        }
        nestArmed={convTarget === g.id}
        onRename={renameGroup}
        onDissolve={dissolveGroup}
        onRemoveRule={removeGroupRule}
        onGrabHead={(e) => startConvDrag(e, "heading", "g:" + g.id, g.name)}
      >
        {items.length > 0 && renderList(items, g)}
        {items.length === 0 && kids.length === 0 && (
          <div className="k-coll-empty">
            Empty collection — drag titles in{!sculpt ? ", or use the + on any title" : ""}.
          </div>
        )}
        {kids.map(renderCollection)}
      </GroupCard>
    );
  };
  const renderStatusSection = (s: Section) => (
    <div
      className="k-section"
      key={s.key}
      data-status-key={s.key}
      data-armed={browseArm && browseArm.kind === "status" && browseArm.status === s.key ? "1" : undefined}
    >
      {s.label && (
        <div className="k-section__head">
          <button
            className="k-section__grip"
            title="Drag up to pin as a tab"
            onPointerDown={(e) => startConvDrag(e, "heading", "s:" + s.key, s.label!)}
          >
            <Ico name="grip" s={13} />
          </button>
          <span className="k-section__name">{s.label}</span>
          <span className="k-section__count">{s.items.length}</span>
        </div>
      )}
      {renderList(s.items, null)}
    </div>
  );
  const emptyTab = (label: string) => (
    <div className="k-emptytab">
      <Ico name="stack" s={26} />
      <div className="k-emptytab__title">“{label}” is empty</div>
      <div className="k-emptytab__hint">
        {sculpt ? (
          "Drag titles in from the All tab, or nest another collection here."
        ) : (
          <>
            Open any title and use the <b>+</b> button to add it here — or hop to the All tab.
          </>
        )}
      </div>
    </div>
  );

  const noGlobals =
    !globals.group.length && !globals.sort.length && !globals.color.length && !globals.tag.length;

  return (
    <div
      className={"k-app" + (paint ? " painting" : "")}
      data-direction={DIRECTION}
      data-sculpt={sculpt ? "on" : "off"}
      data-density={DENSITY}
      style={accent ? ({ "--accent": accent } as React.CSSProperties) : undefined}
    >
      <div className="k-main">
        <SculptSidebar
          onGrabToken={onGrabToken}
          onPaint={(cat, key) => setPaint((p) => (p && p.cat === cat && p.key === key ? null : { cat, key }))}
          paintState={paint}
          globals={globals}
          groups={groups}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
        />

        <div className="k-stage">
          <div className="k-strip">
            <div className="k-strip__eyebrow">
              <span className="k-strip__rule" />
              <a href="/watchlist" className="k-strip__back" title="Back to your lists">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Lists
              </a>
              <span className="k-strip__crumb-sep">/</span>
              {sculpt ? "Shape your list" : "Your list"}
            </div>
            <div className="k-strip__lead">
              <h1 className="k-strip__title">{sculpt ? "Reshape" : wlTitle}</h1>
              <span className="k-strip__count">
                {entries.length} titles · {groups.length} groups
              </span>
            </div>
          </div>

          {/* tab rail */}
          <div className={"k-tabsbar" + (convZone === "rail" ? " drop-armed" : "")}>
            <button className={"k-tab k-tab--home" + (effectiveActive === "list" ? " on" : "")} onClick={() => chooseTab("list")}>
              <Ico name="browse" s={14} /> All
            </button>
            {tabGroups.map((tab) =>
              renamingTab === tab.key ? (
                <input
                  key={tab.key}
                  className="k-tab k-tab--edit"
                  autoFocus
                  defaultValue={tab.label}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    renameTabByKey(tab.key, e.target.value.trim());
                    setRenamingTab(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setRenamingTab(null);
                  }}
                />
              ) : (
                <span key={tab.key} className="k-tab-wrap">
                  <button
                    className={
                      "k-tab k-tab--pinned" +
                      (effectiveActive === tab.key ? " on" : "") +
                      (browseArm && ((tab.key === "g:" + ((browseArm as { id?: string }).id || "")) || (tab.key === "s:" + ((browseArm as { status?: string }).status || ""))) ? " drop-armed" : "")
                    }
                    data-tab-key={tab.key}
                    onClick={() => chooseTab(tab.key)}
                    onPointerDown={(e) => startConvDrag(e, "tab", tab.key, tab.label)}
                    onDoubleClick={() => {
                      if (isGroupKey(tab.key)) setRenamingTab(tab.key);
                    }}
                    title="Click to view · double-click to rename · drag onto a collection to nest, or into All for a section"
                  >
                    {tab.label}
                    <span className="k-tab__count">{tab.items.length}</span>
                  </button>
                  {isGroupKey(tab.key) && (
                    <button
                      className="k-tab__del"
                      aria-label={"Delete " + tab.label}
                      title={tab.items.length === 0 ? "Delete this empty tab" : "Delete this tab (titles stay in your library)"}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        const gid = tab.key.slice(2);
                        if (tab.items.length === 0) {
                          dissolveGroup(gid);
                          if (effectiveActive === tab.key) setActiveTab("list");
                        } else {
                          setTabDelTarget({ gid, key: tab.key, label: tab.label, count: tab.items.length });
                        }
                      }}
                    >
                      <Ico name="x" s={11} />
                    </button>
                  )}
                </span>
              ),
            )}
            <button className="k-tab k-tab--add" onClick={() => createTab(null)} title="Create a new collection tab">
              <Ico name="plus" s={14} /> New
            </button>
            {convKind && (
              <span className="k-tab-hint">
                {convZone === "rail" ? "Release to pin as a tab" : "Onto a collection to nest · into All for a section"}
              </span>
            )}
          </div>

          {/* sub-toolbar */}
          <div className="k-subtools">
            <Segmented
              value={listView}
              onChange={chooseView}
              ariaLabel="Display view"
              options={[
                { value: "list", label: " Rows", icon: <Ico name="viewList" s={14} />, title: "Compact rows view" },
                { value: "cards", label: " Cards", icon: <Ico name="viewCards" s={14} />, title: "Poster card view" },
                { value: "hybrid", label: " Hybrid", icon: <Ico name="viewHybrid" s={14} />, title: "Hybrid — row + excerpt" },
              ]}
            />
            {effectiveActive === "list" && (
              <Segmented
                value={layoutMode}
                onChange={chooseLayout}
                ariaLabel="Arrangement"
                options={[
                  { value: "stack", label: " Stack", icon: <Ico name="layoutStack" s={14} />, title: "Stacked list" },
                  { value: "grid", label: " Layout", icon: <Ico name="layoutGrid" s={14} />, title: sculpt ? "Custom layout — drag & resize the boxes" : "Custom layout — shape it in Sculpt mode" },
                ]}
              />
            )}
            <div className="k-subtools__spacer" />
            {gridLayout && sculpt && (
              <button className="k-resetlayout" onClick={resetLayout} title="Reset all boxes to a tidy default arrangement">
                <Ico name="reset" s={13} /> Reset
              </button>
            )}
            <button
              className={"k-editbtn" + (sculpt ? " on" : "")}
              onClick={() => {
                if (sculpt) {
                  setMode("browse");
                  setPaint(null);
                } else {
                  setMode("sculpt");
                  setSelectedId(null);
                }
              }}
              title={sculpt ? "Exit editing — back to browsing your list" : "Edit your list — reshape, rate, and rearrange"}
            >
              {sculpt ? <Ico name="check" s={15} /> : <Ico name="edit" s={15} />}
              <span>{sculpt ? "Done" : "Edit list"}</span>
            </button>
          </div>

          <div className={"k-scroll" + (convZone === "list" ? " drop-armed" : "")}>
            {entries.length === 0 ? (
              <div className="k-emptytab" style={{ marginTop: 8 }}>
                <Ico name="search" s={26} />
                <div className="k-emptytab__title">No titles yet</div>
                <div className="k-emptytab__hint">
                  Press <b>⌘K</b> (or the search icon up top) to find anime and add them to this
                  list.
                </div>
              </div>
            ) : (
              <Fragment>
            {effectiveActive === "list" && (
              <div className={"k-globals" + (armed && armed.type === "globals" ? " drop-armed" : "")} data-drop="globals">
                <span className="k-globals__label">Everything</span>
                {(["group", "sort", "color", "tag"] as RuleCat[]).flatMap((cat) =>
                  globals[cat].map((k) => (
                    <RuleChip key={cat + ":" + k} cat={cat} ruleKey={k} onRemove={() => removeGlobalRule(cat, k)} />
                  )),
                )}
                {noGlobals && (
                  <span className="k-globals__placeholder">Drag rule tokens here to apply them to your whole list.</span>
                )}
              </div>
            )}

            {/* a pinned tab is open */}
            {effectiveActive !== "list" && activeTabObj && (
              activeTabObj.group ? (
                sculpt ? (
                  renderCollection(activeTabObj.group)
                ) : activeTabObj.items.length > 0 || childrenOf(activeTabObj.group.id).length > 0 ? (
                  <Fragment>
                    {activeTabObj.items.length > 0 && renderList(activeTabObj.items, activeTabObj.group)}
                    {childrenOf(activeTabObj.group.id).map(renderCollection)}
                  </Fragment>
                ) : (
                  emptyTab(activeTabObj.label)
                )
              ) : activeTabObj.items.length > 0 ? (
                renderList(activeTabObj.items, null)
              ) : (
                emptyTab(activeTabObj.label)
              )
            )}

            {/* the List tab (everything inline) */}
            {effectiveActive === "list" && !gridLayout && (
              <Fragment>
                {topColls.map(renderCollection)}
                {listSections.map(renderStatusSection)}
                {topColls.length === 0 && listSections.length === 0 && (
                  <div style={{ padding: "30px 4px", color: "var(--ink-faint)", fontSize: 13 }}>
                    Everything is pinned as a tab — drag one back down here to see it inline.
                  </div>
                )}
              </Fragment>
            )}

            {/* the List tab as a free-form canvas */}
            {effectiveActive === "list" && gridLayout && (
              <div className="k-canvas" ref={attachCanvas} style={{ height: canvasH }}>
                {panelKeys.map((key) => {
                  const node = key.startsWith("g:")
                    ? renderCollection(groupById[key.slice(2)])
                    : renderStatusSection(sectionByKey[key.slice(2)]);
                  return (
                    <LayoutPanel key={key} panelKey={key} rect={rectOf(key)} onMove={setRect} onResize={setRect} onFront={bringFront} readOnly={!sculpt}>
                      {node}
                    </LayoutPanel>
                  );
                })}
                {panelKeys.length === 0 && (
                  <div style={{ padding: "30px 4px", color: "var(--ink-faint)", fontSize: 13 }}>
                    Everything is pinned as a tab — drag one back down here to arrange it.
                  </div>
                )}
              </div>
            )}
              </Fragment>
            )}
          </div>
        </div>

        {/* detail (browse) — full-screen modal overlay */}
        {!sculpt && selected && (
          <Fragment>
            <div className="k-scrim k-scrim--detail" onClick={() => setSelectedId(null)} />
            <DetailPanel
              key={selected.id}
              entry={selected}
              glyphSet={GLYPH_SET}
              showScore={showScore}
              onClose={() => setSelectedId(null)}
              onSetFeeling={setFeeling}
              onSetDim={setDim}
              onSetTake={setTake}
              onRemove={removeEntryFromList}
            />
          </Fragment>
        )}
      </div>

      {/* paint banner */}
      {paint && (
        <div className="k-paint-armed-banner">
          <span style={{ display: "inline-flex" }}>
            <Ico name="brush" s={15} />
          </span>
          Painting{" "}
          <b style={{ margin: "0 2px" }}>
            {CAT_LABEL[paint.cat]} · {(TOKENS[paint.cat].find((x) => x.key === paint.key) || { label: "" }).label}
          </b>{" "}
          — drag across entries
          <button onClick={() => setPaint(null)}>done</button>
        </div>
      )}

      {/* tab-delete confirm dialog */}
      {tabDelTarget && (
        <Fragment>
          <div className="k-scrim k-scrim--modal" onClick={() => setTabDelTarget(null)} />
          <div className="k-modal" role="dialog" aria-modal="true" aria-labelledby="tabdel-title">
            <h3 className="k-modal__title" id="tabdel-title">
              Delete this tab?
            </h3>
            <p className="k-modal__desc">
              You&apos;re about to delete <b>{tabDelTarget.label}</b>. The {tabDelTarget.count} title
              {tabDelTarget.count === 1 ? "" : "s"} inside stay in your library — only the tab, its
              layout, and its scoped rules go away.
            </p>
            <div className="k-modal__row">
              <button className="k-modal__btn k-modal__btn--ghost" onClick={() => setTabDelTarget(null)}>
                Cancel
              </button>
              <button
                className="k-modal__btn k-modal__btn--danger"
                onClick={() => {
                  const t = tabDelTarget;
                  dissolveGroup(t.gid);
                  if (effectiveActive === t.key) setActiveTab("list");
                  setTabDelTarget(null);
                }}
              >
                <Ico name="trash" s={13} /> Delete tab
              </button>
            </div>
          </div>
        </Fragment>
      )}
    </div>
  );
}
