"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
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
  toggleSortRev,
} from "./rules";
import { DisplayMenu } from "./DisplayMenu";
import {
  updateEntryAction,
  removeEntryAction,
  addCustomAxisAction,
  removeCustomAxisAction,
  reorderEntriesAction,
  syncGroupsAction,
} from "@/app/(app)/watchlist/actions";
import { hueValue, type HueKey } from "@/lib/palette";

import { EntryRow } from "./EntryRow";
import { EntryCard } from "./EntryCard";
import { GroupCard, RuleChip } from "./GroupCard";
import { DetailPanel } from "./DetailPanel";
import { SculptSidebar } from "./SculptSidebar";
import { GridCanvas, findScroller, edgeScroll, type GridItem } from "./GridCanvas";
import { Ico } from "./Ico";

import {
  emptyRules,
  type Entry,
  type Feeling,
  type Group,
  type LayoutMode,
  type Mode,
  type PaintState,
  type RuleCat,
  type Rules,
  type Status,
  type ViewMode,
  type Bucket,
  type RateMode,
  type SymbolRating,
} from "./types";

// Fixed presentation tweaks (the prototype's dev-only TweaksPanel is omitted —
// the accent comes from the opened watchlist's hue).
const GLYPH_SET = "orbs" as const;
const DIRECTION = "paper";
const DENSITY = "regular";

const VIEW_KEY = "kokoro_view";
const LAYOUT_KEY = "kokoro_layout_mode";
const GRID_KEY = "kokoro_grid_"; // + list id → per-list free-form grid layout
const SIDEBAR_KEY = "kokoro_sidebar_collapsed";

let _gid = 1;
// real UUIDs so a new collection's client id matches the row we persist for it
const nid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "g" + _gid++;

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
type ArmedTarget = { type: "globals" } | { type: "loose" } | { type: "group" | "entry"; id: string } | null;
type BrowseHit =
  | { kind: "coll"; id: string }
  | { kind: "status"; status: string }
  | { kind: "entry"; id: string; after: boolean }
  | null;
type PendingReorder = { draggedId: string; targetId: string; after: boolean } | null;

export default function WatchlistApp({
  id,
  title,
  hue,
  initialEntries,
  initialCustomAxes,
  initialGroups,
}: {
  id: string;
  title: string;
  hue: HueKey;
  initialEntries: Entry[];
  initialCustomAxes: string[];
  initialGroups: Group[];
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
    initialEntries.map((e, i) => ({ ...e, dims: { ...e.dims }, _order: e._order ?? i })),
  );
  const [customAxes, setCustomAxes] = useState<string[]>(initialCustomAxes);
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
  // The rail is an ordered list of tab keys, "all" (the everything view) plus the
  // pinned collections ("g:<id>"). Order + the "All" tab's custom name persist in
  // localStorage so tabs can be freely reordered/renamed. All is a tab like any
  // other — movable, renamable — and at least one tab is always kept.
  const TABORDER_KEY = "kokoro_taborder_" + id;
  const ALLNAME_KEY = "kokoro_allname_" + id;
  const [tabbed, setTabbed] = useState<string[]>(() => {
    const pinned = initialGroups.filter((g) => !g.parentId).map((g) => "g:" + g.id);
    let saved: unknown = null;
    try { saved = JSON.parse(localStorage.getItem(TABORDER_KEY) || "null"); } catch {}
    if (Array.isArray(saved)) {
      // the saved list is authoritative for which collections are pinned — do NOT
      // re-add unlisted ones, or unpinning (bookmark off) would never survive a
      // reload. Collections that aren't pinned still show as boxes on the board.
      const valid = (saved as string[]).filter((k) => k === "all" || pinned.includes(k));
      if (!valid.includes("all")) valid.unshift("all");
      return valid.length ? valid : ["all"];
    }
    return ["all", ...pinned];
  });
  const [allName, setAllName] = useState<string>(() => {
    // the "All" tab is the home overview — the board itself, not a peer tab
    try { return localStorage.getItem(ALLNAME_KEY) || "Board"; } catch { return "Board"; }
  });
  useEffect(() => {
    try { localStorage.setItem(TABORDER_KEY, JSON.stringify(tabbed)); } catch {}
  }, [tabbed, TABORDER_KEY]);

  const [activeTab, setActiveTab] = useState<string>("list");
  // the soft highlight that glides under the active collection in the rail
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tabHi, setTabHi] = useState<{ x: number; w: number } | null>(null);
  // drag-to-reorder tabs
  const dragTabKey = useRef<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  // touch-only pointer reorder for the tab strip (HTML5 DnD below doesn't fire on
  // touch); desktop mouse keeps using the draggable handlers, untouched.
  const tabTouch = useRef<{ key: string; sx: number; sy: number; started: boolean } | null>(null);
  const tabMovedRef = useRef(false);
  const reorderTab = (toKey: string) => {
    const from = dragTabKey.current;
    dragTabKey.current = null;
    setDropKey(null);
    if (!from || from === toKey) return;
    setTabbed((tt) => {
      const arr = tt.filter((k) => k !== from);
      const ti = arr.indexOf(toKey);
      arr.splice(ti < 0 ? arr.length : ti, 0, from);
      return arr;
    });
  };
  const tabUnderPoint = (x: number, y: number): string | null =>
    ((document.elementFromPoint(x, y) as HTMLElement | null)?.closest("[data-tab-key]"))?.getAttribute("data-tab-key") ?? null;
  const tabTouchMove = (e: PointerEvent) => {
    const d = tabTouch.current;
    if (!d) return;
    if (!d.started) {
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 8) return;
      d.started = true;
      tabMovedRef.current = true;
      dragTabKey.current = d.key;
      document.body.style.cursor = "grabbing";
    }
    const k = tabUnderPoint(e.clientX, e.clientY);
    setDropKey(k && k !== d.key ? k : null);
  };
  const tabTouchUp = (e: PointerEvent) => {
    window.removeEventListener("pointermove", tabTouchMove);
    window.removeEventListener("pointerup", tabTouchUp);
    document.body.style.cursor = "";
    const d = tabTouch.current;
    tabTouch.current = null;
    if (!d || !d.started) { dragTabKey.current = null; setDropKey(null); return; }
    const k = tabUnderPoint(e.clientX, e.clientY);
    if (k) reorderTab(k);
    else { dragTabKey.current = null; setDropKey(null); }
  };
  const startTabTouchReorder = (e: React.PointerEvent, key: string) => {
    tabTouch.current = { key, sx: e.clientX, sy: e.clientY, started: false };
    tabMovedRef.current = false;
    window.addEventListener("pointermove", tabTouchMove);
    window.addEventListener("pointerup", tabTouchUp);
  };
  const renameAll = (name: string) => {
    const clean = name.trim().slice(0, 40) || "Board";
    setAllName(clean);
    try { localStorage.setItem(ALLNAME_KEY, clean); } catch {}
  };
  // remove a tab from the rail — always keeping at least one
  const deleteTabKey = (key: string) => {
    // The All tab is permanent — it's the home view of the whole list.
    if (key === "all") return;
    if (tabbed.length <= 1) return;
    const gid = key.slice(2);
    const t = tabObjFor(key);
    if (t && t.items.length === 0) {
      dissolveGroup(gid);
      setTabbed((tt) => tt.filter((k) => k !== key));
      if (activeTab === key) setActiveTab("list");
    } else {
      setTabDelTarget({ gid, key, label: t?.label || "", count: t?.items.length || 0 });
    }
  };

  const chooseTab = (key: string) => {
    if (key === activeTab) return;
    // The All (list) view can hold the entire library; a view-transition snapshot
    // of that much DOM (and its per-card morphs) is janky, so switch to/from it
    // plainly. Keep the morph only between the lighter collection tabs.
    if (key === "list" || activeTab === "list") {
      setActiveTab(key);
      return;
    }
    startViewTransition(() => flushSync(() => setActiveTab(key)));
  };


  const [globals, setGlobals] = useState<Rules>(emptyRules);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [paintOver, setPaintOver] = useState<Record<string, { color?: string; tags: string[] }>>({});
  const [paint, setPaint] = useState<PaintState>(null);
  const [armed, setArmed] = useState<ArmedTarget>(null);
  // tap-to-apply: a rule "picked up" by tapping it, then dropped by tapping a
  // target — the touch-friendly alternative to dragging.
  const [pickRule, setPickRule] = useState<{ cat: RuleCat; key: string } | null>(null);
  const [renamingTab, setRenamingTab] = useState<string | null>(null);
  const [tabDelTarget, setTabDelTarget] = useState<{ gid: string; key: string; label: string; count: number } | null>(null);

  const [listView, setListView] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as ViewMode) || "cards";
    } catch {
      return "cards";
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
  // On narrow screens the sidebar overlays the stage, so start it collapsed
  // (unless the user has set an explicit preference) — the list stays visible.
  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_KEY) == null && window.matchMedia("(max-width: 980px)").matches) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSidebarCollapsed(true);
      }
    } catch {}
  }, []);

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
      flushSync(() => {
        setLayoutMode(m);
        // the free-form canvas is the whole-list board, so jump to All where it
        // renders (rather than leaving the user on a focused collection tab)
        if (m === "grid") setActiveTab("list");
      });
      try {
        localStorage.setItem(LAYOUT_KEY, m);
      } catch {}
    });
  };

  // Free-form grid canvas: box positions/sizes persist inside GridCanvas under a
  // per-list key. Reset bumps this token so GridCanvas re-packs into a tidy grid.
  const [resetToken, setResetToken] = useState(0);
  const resetLayout = () => setResetToken((t) => t + 1);
  const seedRef = useRef(1);

  // Per-card "bento" size inside a box — cards can be cycled bigger so the board
  // reads as a curated grid. Persists per list, keyed by entry id.
  const CARDSIZE_KEY = "kokoro_cardsize_" + id;
  const [cardSizes, setCardSizes] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(CARDSIZE_KEY) || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(CARDSIZE_KEY, JSON.stringify(cardSizes));
    } catch {}
  }, [cardSizes, CARDSIZE_KEY]);

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
  // Flip a sort rule's direction in place (adds/removes the ":rev" suffix).
  const toggleGlobalSortDir = (cat: RuleCat, key: string) => {
    if (cat !== "sort") return;
    setGlobals((g) => ({ ...g, sort: g.sort.map((k) => (k === key ? toggleSortRev(k) : k)) }));
  };
  const toggleGroupSortDir = (gid: string, cat: RuleCat, key: string) => {
    if (cat !== "sort") return;
    setGroups((gs) =>
      gs.map((g) =>
        g.id === gid
          ? { ...g, scoped: { ...g.scoped, sort: (g.scoped.sort || []).map((k) => (k === key ? toggleSortRev(k) : k)) } }
          : g,
      ),
    );
  };
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

  // Reorder a title WITHIN its collection. A box renders its members in
  // g.entryIds order (collItemsSorted), so a same-box reorder has to rewrite
  // entryIds — not the global entries array (which the box never reads).
  const reorderWithinGroup = (gid: string, draggedId: string, targetId: string, after: boolean) =>
    setGroups((gs) =>
      gs.map((g) => {
        if (g.id !== gid) return g;
        const ids = g.entryIds.filter((x) => x !== draggedId);
        const ti = ids.indexOf(targetId);
        if (ti < 0) return g;
        ids.splice(after ? ti + 1 : ti, 0, draggedId);
        return { ...g, entryIds: ids };
      }),
    );

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

  // ---- per-episode watched tracking -----------------------------------------
  const epRange = (n: number) => Array.from({ length: Math.max(0, n) }, (_, i) => i + 1);
  // the explicit watched set, backfilling legacy entries (progress but no set)
  const watchedSetOf = (e: Entry): number[] =>
    e.watchedEps && e.watchedEps.length
      ? e.watchedEps
      : e.progress
        ? epRange(Math.min(e.progress, e.episodes))
        : [];

  // Debounce the watched persist per entry: rapid toggles each send the FULL
  // set, so concurrent fire-and-forget writes could land out of order and leave
  // a stale set in the DB. Coalescing to the latest set fixes that (and cuts writes).
  const watchedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** Set exactly which episodes are watched; derives progress + status. */
  const setWatched = (id: string, epsRaw: number[]) => {
    const cur = entries.find((e) => e.id === id);
    if (!cur) return;
    const eps = [...new Set(epsRaw.filter((n) => n >= 1 && n <= cur.episodes))].sort((a, b) => a - b);
    const progress = eps.length;
    let status: Status = cur.status;
    if (cur.episodes > 0 && progress >= cur.episodes) status = "completed";
    else if (progress > 0 && cur.status === "planned") status = "watching";
    else if (progress === 0 && cur.status === "completed") status = "watching";
    const patch = { watchedEps: eps, progress, status };
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    clearTimeout(watchedTimers.current[id]);
    watchedTimers.current[id] = setTimeout(() => persist(id, patch), 220);
  };
  const toggleWatched = (id: string, n: number) => {
    const cur = entries.find((e) => e.id === id);
    if (!cur) return;
    const set = new Set(watchedSetOf(cur));
    if (set.has(n)) set.delete(n);
    else set.add(n);
    setWatched(id, [...set]);
  };
  const markAllWatched = (id: string) => {
    const cur = entries.find((e) => e.id === id);
    if (cur) setWatched(id, epRange(cur.episodes));
  };
  const clearWatched = (id: string) => setWatched(id, []);

  const STATUS_OK: Record<string, number> = { watching: 1, completed: 1, planned: 1 };
  const setEntryStatus = (id: string, status: string) => {
    if (!STATUS_OK[status]) return;
    const cur = entries.find((e) => e.id === id);
    if (!cur) return;
    if (status === "completed") {
      if (cur.episodes > 0) return setWatched(id, epRange(cur.episodes)); // mark all → completed
    }
    const patch: { status: Status; progress?: number; watchedEps?: number[] } = { status: status as Status };
    if (status === "planned") { patch.progress = 0; patch.watchedEps = []; }
    else if (status === "completed") patch.progress = cur.episodes; // episodes === 0 fallthrough
    else if (status === "watching" && (cur.progress == null || cur.progress >= cur.episodes)) {
      patch.progress = Math.max(1, Math.floor(cur.episodes / 4));
      patch.watchedEps = epRange(patch.progress);
    }
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    persist(id, patch);
  };
  /** "+1": mark the next unwatched episode watched. */
  const bumpEpisode = (id: string) => {
    const cur = entries.find((e) => e.id === id);
    if (!cur || cur.episodes <= 0) return;
    const set = watchedSetOf(cur);
    let next = 0;
    for (let n = 1; n <= cur.episodes; n++) if (!set.includes(n)) { next = n; break; }
    if (next) setWatched(id, [...set, next]);
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
  // bookmark a box: pin/unpin it as a tab in the rail (the box stays on the board)
  const togglePin = (key: string) => {
    const isPinned = tabbed.includes(key);
    setTabbed((t) => (isPinned ? t.filter((k) => k !== key) : [...t, key]));
    if (isPinned && activeTab === key) setActiveTab("list");
  };
  const isGroupKey = (k: unknown): k is string => typeof k === "string" && k.startsWith("g:");
  const renameTabByKey = (key: string, name: string) => {
    if (key === "all") renameAll(name);
    else if (isGroupKey(key)) renameGroup(key.slice(2), name);
  };

  // Persist collections + their membership whenever they change. Local state is
  // the source of truth; this debounced sync mirrors it to the DB (skipping the
  // first run, which is just the server-loaded state). Scoped rules are not
  // persisted — they stay client-only like the global rules.
  const groupsHydrated = useRef(false);
  useEffect(() => {
    if (!groupsHydrated.current) {
      groupsHydrated.current = true;
      return;
    }
    const t = setTimeout(() => {
      void syncGroupsAction(
        id,
        groups.map((g, i) => ({
          id: g.id,
          name: g.name,
          parentId: g.parentId,
          position: i,
          entryIds: g.entryIds,
        })),
      ).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [groups, id]);

  /* ----------------------- impression edits ----------------------- */
  const upd = (id: string, patch: Partial<Entry>) =>
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const setFeeling = (id: string, f: Feeling | null) => {
    upd(id, { feeling: f });
    persist(id, { feeling: f });
  };
  const setRateMode = (id: string, m: RateMode) => {
    upd(id, { rateMode: m });
    persist(id, { rateMode: m });
  };
  const setSymbol = (id: string, s: SymbolRating | null) => {
    upd(id, { symbol: s });
    persist(id, { symbol: s });
  };
  const setDim = (id: string, d: string, v: number) => {
    const cur = entries.find((e) => e.id === id);
    if (!cur) return;
    const dims = { ...cur.dims, [d]: v };
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, dims } : e)));
    persist(id, { dims });
  };
  // Shared custom axes — optimistic, reconciled with the server's canonical list.
  const addAxis = (name: string) => {
    void addCustomAxisAction(id, name).then((next) => {
      if (next) setCustomAxes(next);
    });
  };
  const removeAxis = (name: string) => {
    setCustomAxes((ax) => ax.filter((a) => a !== name));
    void removeCustomAxisAction(id, name).then(setCustomAxes);
  };
  // entry.take is a denormalised mirror of the most-recent take (for the card
  // preview); the take notes themselves live in the Journal (see TakeNotes).
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

  const findTarget = (x: number, y: number, kind: "token" | "entry", excludeId?: string): ArmedTarget => {
    const start = document.elementFromPoint(x, y) as HTMLElement | null;
    // a title dropped anywhere in the loose zone gets unsorted (removed from its
    // collection) — the reverse of dragging it into a box
    if (kind === "entry" && start?.closest('[data-drop="loose"]')) return { type: "loose" };
    let el = start;
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
  const browseDrag = useRef<{ id: string; sx: number; sy: number; started: boolean; label: string; ghost?: HTMLElement; srcEl?: HTMLElement; touch?: boolean; fromGrip?: boolean; lastX?: number; lastY?: number } | null>(null);
  const browseRaf = useRef(0);
  const browseScroller = useRef<HTMLElement | null>(null);
  const [browseArm, setBrowseArm] = useState<BrowseHit>(null);
  const [pendingReorder, setPendingReorder] = useState<PendingReorder>(null);
  const reorderEl = useRef<HTMLElement | null>(null);
  const clearReorderHint = () => {
    if (reorderEl.current) {
      reorderEl.current.classList.remove("k-reorder-before", "k-reorder-after");
      reorderEl.current = null;
    }
  };

  // the list flattened in its current on-screen order, so a manual reorder
  // begins from whatever sort/grouping the user is looking at.
  const flatDisplayOrder = (): Entry[] => {
    const cmp = chainedComparator(globals.sort, "s" + seedRef.current);
    const sortArr = (arr: Entry[]) => (cmp ? [...arr].sort(cmp) : arr);
    const grp = globals.group[0] || null;
    if (!grp) return sortArr(entries);
    const map: Record<string, { order: number; label: string | null; items: Entry[] }> = {};
    for (const e of entries) {
      const bkt = bucketOf(e, grp);
      (map[bkt.key] = map[bkt.key] || { order: bkt.order, label: bkt.label, items: [] }).items.push(e);
    }
    return Object.values(map)
      .sort((a, b) => a.order - b.order || (a.label || "").localeCompare(b.label || ""))
      .flatMap((s) => sortArr(s.items));
  };
  const moveInOrder = (base: Entry[], draggedId: string, targetId: string, after: boolean): Entry[] | null => {
    const dragged = base.find((e) => e.id === draggedId);
    if (!dragged) return null;
    const arr = base.filter((e) => e.id !== draggedId);
    const ti = arr.findIndex((e) => e.id === targetId);
    if (ti < 0) return null;
    arr.splice(after ? ti + 1 : ti, 0, dragged);
    return arr;
  };
  const commitOrder = (arr: Entry[]) => {
    setEntries(arr);
    void reorderEntriesAction(id, arr.map((e) => e.id)).catch(() => {});
  };
  const confirmReorder = () => {
    const pr = pendingReorder;
    setPendingReorder(null);
    if (!pr) return;
    const arr = moveInOrder(flatDisplayOrder(), pr.draggedId, pr.targetId, pr.after);
    setGlobals((g) => ({ ...g, sort: [], group: [] })); // clear the overridden rules
    if (arr) commitOrder(arr);
  };

  const dropHitAt = (x: number, y: number): BrowseHit => {
    let el = document.elementFromPoint(x, y) as HTMLElement | null;
    while (el && el !== document.body) {
      const ds = el.dataset;
      if (ds) {
        if (ds.tabKey) {
          if (ds.tabKey.startsWith("g:")) return { kind: "coll", id: ds.tabKey.slice(2) };
          if (ds.tabKey.startsWith("s:")) return { kind: "status", status: ds.tabKey.slice(2) };
        }
        if (ds.collid) return { kind: "coll", id: ds.collid };
        if (ds.statusKey) return { kind: "status", status: ds.statusKey };
        if (ds.drop === "entry" && ds.entryId) {
          const r = el.getBoundingClientRect();
          // grid cards split left/right; stacked rows & hybrid split top/bottom
          const after = el.classList.contains("k-card")
            ? x > r.left + r.width / 2
            : y > r.top + r.height / 2;
          return { kind: "entry", id: ds.entryId, after };
        }
      }
      el = el.parentElement;
    }
    return null;
  };
  const onEntryBrowse = (e: RPointerEvent, id: string, fromGrip = false) => {
    if (sculpt) return;
    if (e.button != null && e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".k-addwrap, .k-addmenu, button, input, textarea, a")) return;
    // sweep up any ghost left behind by an interrupted drag (belt-and-braces)
    document.querySelectorAll(".k-entrydrag-ghost").forEach((n) => n.remove());
    const entry = byId[id];
    browseDrag.current = {
      id, sx: e.clientX, sy: e.clientY, started: false,
      label: entry ? entry.title : "", srcEl: e.currentTarget as HTMLElement,
      touch: e.pointerType === "touch", fromGrip,
    };
    window.addEventListener("pointermove", onEntryBrowseMove);
    window.addEventListener("pointerup", onEntryBrowseUp);
    window.addEventListener("pointercancel", onEntryBrowseUp);
  };
  // nearest title (by vertical distance) inside a collection box — lets a drop
  // released in the box's whitespace insert at the right slot instead of the end
  const nearestEntryHit = (collId: string, y: number, excludeId: string): { id: string; after: boolean } | null => {
    const box = document.querySelector(`[data-group-id="${collId}"]`);
    if (!box) return null;
    const els = [...box.querySelectorAll<HTMLElement>('[data-drop="entry"][data-entry-id]')].filter(
      (el) => el.dataset.entryId && el.dataset.entryId !== excludeId,
    );
    let best: { id: string; after: boolean } | null = null;
    let bestDist = Infinity;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const dist = Math.abs(y - mid);
      if (dist < bestDist) { bestDist = dist; best = { id: el.dataset.entryId!, after: y > mid }; }
    }
    return best;
  };
  // Resolve the drop under (x,y). When over a box the dragged title ALREADY
  // lives in, treat it as a reorder onto the nearest title (so releasing in the
  // box whitespace inserts by position instead of appending to the bottom).
  const resolveBrowseHit = (x: number, y: number, dragId: string): BrowseHit => {
    let hit = dropHitAt(x, y);
    if (hit && hit.kind === "coll") {
      const dg = groups.find((g) => g.entryIds.includes(dragId));
      if (dg && dg.id === hit.id && effSortKeys(dg).length === 0) {
        const n = nearestEntryHit(hit.id, y, dragId);
        if (n) hit = { kind: "entry", id: n.id, after: n.after };
      }
    }
    return hit;
  };
  const updateBrowseHit = (x: number, y: number) => {
    const d = browseDrag.current;
    if (!d || !d.started) return;
    if (d.ghost) d.ghost.style.transform = `translate(${x + 14}px, ${y - 18}px)`;
    const hit = resolveBrowseHit(x, y, d.id);
    clearReorderHint();
    if (hit && hit.kind === "entry" && hit.id !== d.id) {
      // reorder target: show an insertion line on the hovered/nearest entry
      const tgt = document.querySelector(`[data-drop="entry"][data-entry-id="${hit.id}"]`) as HTMLElement | null;
      if (tgt) { tgt.classList.add(hit.after ? "k-reorder-after" : "k-reorder-before"); reorderEl.current = tgt; }
      setBrowseArm(null);
      if (d.ghost) d.ghost.classList.add("on");
    } else {
      const tabHit = hit && hit.kind !== "entry" ? hit : null;
      setBrowseArm(tabHit);
      if (d.ghost) d.ghost.classList.toggle("on", !!tabHit);
    }
  };
  const onEntryBrowseMove = (e: PointerEvent) => {
    const d = browseDrag.current;
    if (!d) return;
    if (!d.started) {
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 8) return;
      // On touch, only a grip-initiated drag becomes a real drag — a touch that
      // starts on the row body is a scroll/tap, so bail and let the browser
      // scroll (a scroll fires pointercancel, which suppresses the tap-open).
      if (d.touch && !d.fromGrip) return;
      d.started = true;
      document.body.classList.add("k-entry-dragging");
      if (d.srcEl) d.srcEl.classList.add("k-dragsrc");
      const g = document.createElement("div");
      g.className = "k-entrydrag-ghost";
      g.textContent = d.label || "Untitled";
      document.body.appendChild(g);
      // start position so the entrance animation reads from under the cursor
      g.style.transform = `translate(${e.clientX + 14}px, ${e.clientY - 18}px)`;
      d.ghost = g;
      // the drag handle blocks native scrolling, so drive it near the edges —
      // otherwise a title can't be dropped past the fold (it lands at the end)
      browseScroller.current = findScroller(d.srcEl || null);
      cancelAnimationFrame(browseRaf.current);
      const loop = () => {
        const dd = browseDrag.current;
        if (!dd || !dd.started) return;
        edgeScroll(browseScroller.current, dd.lastY ?? 0);
        updateBrowseHit(dd.lastX ?? 0, dd.lastY ?? 0);
        browseRaf.current = requestAnimationFrame(loop);
      };
      browseRaf.current = requestAnimationFrame(loop);
    }
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    updateBrowseHit(e.clientX, e.clientY);
  };
  const onEntryBrowseUp = (e: PointerEvent) => {
    window.removeEventListener("pointermove", onEntryBrowseMove);
    window.removeEventListener("pointerup", onEntryBrowseUp);
    window.removeEventListener("pointercancel", onEntryBrowseUp);
    cancelAnimationFrame(browseRaf.current);
    document.body.classList.remove("k-entry-dragging");
    clearReorderHint();
    const d = browseDrag.current;
    browseDrag.current = null;
    setBrowseArm(null);
    if (d?.srcEl) d.srcEl.classList.remove("k-dragsrc");
    if (d?.ghost) d.ghost.remove();
    if (!d) return;
    if (e.type === "pointercancel") return; // aborted — no drop, no select
    if (!d.started) {
      setSelectedId(d.id);
      return;
    }
    const hit = resolveBrowseHit(e.clientX, e.clientY, d.id);
    if (!hit) return;
    if (hit.kind === "coll") addToGroup(d.id, hit.id);
    else if (hit.kind === "status") setEntryStatus(d.id, hit.status);
    else if (hit.kind === "entry" && hit.id !== d.id) {
      // Reorder within a collection → rewrite that box's entryIds (the box
      // orders by entryIds, not the global entries array). Only when both
      // titles live in the SAME box and it has no scoped sort overriding order.
      const dg = groups.find((g) => g.entryIds.includes(d.id));
      const tg = groups.find((g) => g.entryIds.includes(hit.id));
      if (dg && tg && dg.id === tg.id && effSortKeys(dg).length === 0) {
        reorderWithinGroup(dg.id, d.id, hit.id, hit.after);
      } else if (globals.sort.length > 0 || globals.group.length > 0) {
        // manual reorder of the flat list — if an automatic sort/grouping is
        // active, confirm first (it clears those rules)
        setPendingReorder({ draggedId: d.id, targetId: hit.id, after: hit.after });
      } else {
        const arr = moveInOrder(entries, d.id, hit.id, hit.after);
        if (arr) commitOrder(arr);
      }
    }
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
    if (!d.started) {
      // a tap (no drag) on a rule token toggles tap-to-apply: pick it up, then
      // tap Everything or a collection to add it there (tap the token to cancel)
      if (d.kind === "token") setPickRule((p) => (p && p.cat === d.cat && p.key === d.key ? null : { cat: d.cat!, key: d.key! }));
      return;
    }
    const tgt = findTarget(e.clientX, e.clientY, d.kind === "token" ? "token" : "entry", d.id);
    if (!tgt) return;
    if (d.kind === "entry") {
      if (tgt.type === "entry") mergeOnto(d.id!, tgt.id);
      else if (tgt.type === "group") addToGroup(d.id!, tgt.id);
      else if (tgt.type === "loose") removeFromCollection(d.id!);
    } else if (d.kind === "token") {
      if (tgt.type === "globals") addGlobalRule(d.cat!, d.key!);
      else if (tgt.type === "group") addGroupRule(tgt.id, d.cat!, d.key!);
    }
  };

  // Tap-to-apply: while a rule is picked up, a tap on Everything or a collection
  // adds it there. Taps inside the palette are ignored; a tap elsewhere cancels.
  useEffect(() => {
    if (!pickRule) return;
    const onTap = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".k-sidebar")) return;
      const tgt = findTarget(e.clientX, e.clientY, "token");
      if (tgt) {
        if (tgt.type === "globals") addGlobalRule(pickRule.cat, pickRule.key);
        else if (tgt.type === "group") addGroupRule(tgt.id, pickRule.cat, pickRule.key);
        e.preventDefault();
        e.stopPropagation();
      }
      setPickRule(null);
    };
    window.addEventListener("click", onTap, true);
    return () => window.removeEventListener("click", onTap, true);
  }, [pickRule]);

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
  // Browse mode shows EVERY title in the "All" view (collections are slices you
  // open via their tab); sculpt mode shows only ungrouped titles so you can
  // organise them into collections.
  const sectionBase = mode === "sculpt" ? singles : entries.filter(matches);

  let sections: Section[] = [];
  const primaryGroup = globals.group[0] || null;
  if (primaryGroup) {
    const map: Record<string, Section & { order: number }> = {};
    sectionBase.forEach((e) => {
      const b: Bucket = bucketOf(e, primaryGroup);
      (map[b.key] = map[b.key] || { key: b.key, label: b.label, order: b.order, items: [] }).items.push(e);
    });
    sections = Object.values(map).sort((a, b) => a.order - b.order || (a.label || "").localeCompare(b.label || ""));
    sections.forEach((s) => (s.items = sortSingles(s.items)));
  } else {
    sections = [{ key: "all", label: null, items: sortSingles(sectionBase) }];
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

  // slide the highlight under whichever collection is active (re-measures on
  // switch, when the rail's contents change, and on resize)
  useLayoutEffect(() => {
    const measure = () => {
      const bar = tabsRef.current;
      const el = bar?.querySelector<HTMLElement>(".k-tab.on");
      if (!bar || !el) {
        setTabHi(null);
        return;
      }
      // getBoundingClientRect is robust to the wrapped/positioned pinned tabs;
      // + scrollLeft converts to the rail's scrollable content space.
      const br = bar.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      setTabHi({ x: er.left - br.left + bar.scrollLeft, w: er.width });
    };
    measure();
    const raf = requestAnimationFrame(measure); // catch post view-transition layout
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [effectiveActive, tabbed, tabGroups.length]);
  const topColls = groups.filter((g) => !g.parentId && !tabbed.includes("g:" + g.id));
  const listSections = sections.filter((s) => s.items.length > 0 && !tabbed.includes("s:" + s.key));
  const sectionByKey: Record<string, Section> = {};
  sections.forEach((s) => (sectionByKey[s.key] = s));
  // On the free-form canvas EVERY top-level collection is a reshapeable box
  // (whether or not it's pinned as a tab). Only NAMED sections (e.g. status
  // buckets when grouping) join them — the catch-all ungrouped "everything"
  // bucket isn't a box; it clutters the board (it's still on the All tab).
  const canvasColls = groups.filter((g) => !g.parentId);
  const canvasSections = listSections.filter((s) => s.label);
  const panelKeys = [...canvasColls.map((g) => "g:" + g.id), ...canvasSections.map((s) => "s:" + s.key)];
  // Ungrouped titles that aren't a named box (the catch-all bucket) don't belong
  // to any collection — on the free-form board they float LOOSE on the canvas so
  // you can see them and drag them into a collection to file them.
  const looseTitles = listSections.filter((s) => !s.label).flatMap((s) => s.items);

  // Estimate a box's natural height in GridCanvas rows (~32px/row) from how many
  // titles it holds, so the auto-packed default isn't uniformly stubby.
  const estRows = (key: string) => {
    let n = 0;
    if (key.startsWith("g:")) {
      const g = groupById[key.slice(2)];
      n = g ? g.entryIds.length : 0;
    } else {
      const s = sectionByKey[key.slice(2)];
      n = s ? s.items.length : 0;
    }
    const px = Math.max(220, Math.min(520, 168 + n * 44));
    return Math.round(px / 32);
  };
  // A box's tint is the rule-category colours MIXED like paint into one colour that
  // washes the whole box. Every active rule contributes: rules on "Everything"
  // (globals) tint every box; rules scoped to a collection tint just that box, and
  // stack with the globals. Combining categories yields a genuinely new colour.
  // A HARMONIOUS palette: all four hues sit within a ~145° arc (jewel tones,
  // teal→blue→violet→rose) so no two are near-complementary — every blend lands on
  // a clean intermediate (teal+rose = violet, etc.) instead of muddy brown/grey.
  const CAT: Record<RuleCat, { l: number; c: number; h: number }> = {
    sort: { l: 0.72, c: 0.14, h: 200 }, // teal
    group: { l: 0.66, c: 0.15, h: 255 }, // blue
    tag: { l: 0.64, c: 0.15, h: 300 }, // violet
    color: { l: 0.68, c: 0.16, h: 345 }, // rose
  };
  // Each category is weighted by HOW MANY of its rules are applied — stacking more
  // rules of one category pulls the blend further toward that colour (like adding
  // more of one paint), and combining categories yields a new colour.
  const mixTint = (weights: Partial<Record<RuleCat, number>>): string | null => {
    let a = 0, b = 0, l = 0, total = 0;
    (Object.keys(weights) as RuleCat[]).forEach((cat) => {
      const w = weights[cat] || 0;
      if (w <= 0) return;
      const { l: L, c, h } = CAT[cat];
      const r = (h * Math.PI) / 180;
      a += w * c * Math.cos(r);
      b += w * c * Math.sin(r);
      l += w * L;
      total += w;
    });
    if (total === 0) return null;
    a /= total; b /= total; l /= total;
    const H = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    // keep chroma healthy so blends stay a live colour (the harmonious palette
    // means the hue itself is always pleasant); floor prevents grey mud
    const C = Math.min(0.16, Math.hypot(a, b) * 1.4 + 0.07);
    return `oklch(${l.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
  };
  const tintFor = (key: string): React.CSSProperties => {
    const weights: Partial<Record<RuleCat, number>> = {};
    const g = key.startsWith("g:") ? groupById[key.slice(2)] : undefined;
    (Object.keys(CAT) as RuleCat[]).forEach((cat) => {
      const w = (globals[cat]?.length || 0) + (g?.scoped?.[cat]?.length || 0);
      if (w) weights[cat] = w;
    });
    const color = mixTint(weights);
    return color ? ({ "--tint": color } as React.CSSProperties) : {};
  };
  const gridLayout = layoutMode === "grid" && effectiveActive === "list";

  /* ----------------------- renderers ----------------------- */
  // Cards get 4 preset sizes; hybrid only widens (its height is content-driven).
  const CARD_SIZES = ["reg", "wide", "tall", "big"];
  const HYBRID_SIZES = ["reg", "wide"];
  const cycleCardSize = (eid: string) => {
    const ring = effView === "cards" ? CARD_SIZES : HYBRID_SIZES;
    setCardSizes((prev) => {
      const cur = prev[eid] || "reg";
      const next = ring[(ring.indexOf(cur) + 1 + ring.length) % ring.length] || "reg";
      const out = { ...prev };
      if (next === "reg") delete out[eid];
      else out[eid] = next;
      return out;
    });
  };
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
    return (
      <EntryCard
        key={e.id}
        {...common}
        view={effView}
        mode={mode}
        onGrab={onGrabEntry}
        size={cardSizes[e.id] || "reg"}
        onResize={sculpt && gridLayout ? () => cycleCardSize(e.id) : undefined}
      />
    );
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
        onRename={renameGroup}
        onDissolve={dissolveGroup}
        onRemoveRule={removeGroupRule}
        onToggleRule={toggleGroupSortDir}
        pinned={!g.parentId ? tabbed.includes("g:" + g.id) : undefined}
        onTogglePin={!g.parentId ? (gid) => togglePin("g:" + gid) : undefined}
        onOpen={!g.parentId ? (gid) => chooseTab("g:" + gid) : undefined}
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
      data-picking={pickRule ? "1" : undefined}
      style={accent ? ({ "--accent": accent } as React.CSSProperties) : undefined}
    >
      <div className="k-main">
        <SculptSidebar
          onGrabToken={onGrabToken}
          onPaint={(cat, key) => setPaint((p) => (p && p.cat === cat && p.key === key ? null : { cat, key }))}
          paintState={paint}
          globals={globals}
          groups={groups}
          customAxes={customAxes}
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

          {/* tab rail — every tab (incl. All) is reorderable + renamable */}
          <div ref={tabsRef} className="k-tabsbar">
            {tabHi && <span className="k-tabhi" style={{ transform: `translateX(${tabHi.x}px)`, width: tabHi.w }} aria-hidden="true" />}
            {tabbed.map((key) => {
              const isAll = key === "all";
              const tab = isAll ? null : tabObjFor(key);
              if (!isAll && !tab) return null; // a dissolved collection — skip
              const label = isAll ? allName : tab!.label;
              const count = isAll ? entries.length : tab!.items.length;
              const active = isAll ? effectiveActive === "list" : effectiveActive === key;
              if (renamingTab === key) {
                return (
                  <input
                    key={key}
                    className="k-tab k-tab--edit"
                    autoFocus
                    defaultValue={label}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      renameTabByKey(key, e.target.value.trim());
                      setRenamingTab(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenamingTab(null);
                    }}
                  />
                );
              }
              const armed = !isAll && browseArm && ((key === "g:" + ((browseArm as { id?: string }).id || "")) || (key === "s:" + ((browseArm as { status?: string }).status || "")));
              return (
                <span
                  key={key}
                  className={"k-tab-wrap" + (dropKey === key ? " k-tab-wrap--drop" : "")}
                  draggable
                  onDragStart={(e) => {
                    dragTabKey.current = key;
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dropKey !== key) setDropKey(key);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropKey((d) => (d === key ? null : d));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    reorderTab(key);
                  }}
                  onDragEnd={() => {
                    dragTabKey.current = null;
                    setDropKey(null);
                  }}
                >
                  <button
                    className={"k-tab " + (isAll ? "k-tab--home" : "k-tab--pinned") + (active ? " on" : "") + (armed ? " drop-armed" : "")}
                    data-tab-key={key}
                    onPointerDown={(e) => { if (e.pointerType === "touch") startTabTouchReorder(e, key); }}
                    onClick={() => { if (tabMovedRef.current) { tabMovedRef.current = false; return; } chooseTab(isAll ? "list" : key); }}
                    onDoubleClick={() => setRenamingTab(key)}
                    title="Click to view · double-click to rename · drag to reorder"
                  >
                    {isAll && <Ico name="browse" s={14} />}
                    {label}
                    <span className="k-tab__count">{count}</span>
                  </button>
                  {!isAll && tabbed.length > 1 && (
                    <button
                      className="k-tab__del"
                      aria-label={"Delete " + label}
                      title="Delete this tab (titles stay in your library)"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTabKey(key);
                      }}
                    >
                      <Ico name="x" s={11} />
                    </button>
                  )}
                </span>
              );
            })}
            <button className="k-tab k-tab--add" onClick={() => createTab(null)} title="Create a new collection tab">
              <Ico name="plus" s={14} /> New
            </button>
          </div>

          {/* sub-toolbar */}
          <div className="k-subtools">
            <DisplayMenu
              display={listView}
              layout={layoutMode}
              showLayout={false}
              onDisplay={chooseView}
              onLayout={chooseLayout}
            />
            {/* layout toggle — the way to get reshapeable boxes, obvious in Shape mode */}
            {sculpt && (
              <div className="k-layoutseg" role="group" aria-label="Layout">
                <button
                  type="button"
                  className={"k-layoutseg__b" + (layoutMode === "stack" ? " on" : "")}
                  onClick={() => chooseLayout("stack")}
                  title="Stacked list"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="4" y="5" width="16" height="4" rx="1" /><rect x="4" y="11" width="16" height="4" rx="1" /><rect x="4" y="17" width="16" height="3" rx="1" /></svg>
                  Stacked
                </button>
                <button
                  type="button"
                  className={"k-layoutseg__b" + (layoutMode === "grid" ? " on" : "")}
                  onClick={() => chooseLayout("grid")}
                  title="Free-form — drag & resize the boxes on a canvas"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="3" y="4" width="8" height="9" rx="1.5" /><rect x="13" y="4" width="8" height="5" rx="1.5" /><rect x="3" y="15" width="8" height="5" rx="1.5" /><rect x="13" y="11" width="8" height="9" rx="1.5" /></svg>
                  Free-form
                </button>
              </div>
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
              title={sculpt ? "Exit editing — back to browsing your list" : "Shape your list — group, sort, colour, and freely arrange it"}
            >
              {sculpt ? <Ico name="check" s={15} /> : <Ico name="edit" s={15} />}
              <span>{sculpt ? "Done" : "Shape list"}</span>
            </button>
          </div>

          <div className="k-scroll">
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
            {effectiveActive === "list" && sculpt && (
              <div className={"k-globals" + (armed && armed.type === "globals" ? " drop-armed" : "")} data-drop="globals">
                <span className="k-globals__label">Everything</span>
                {(["group", "sort", "color", "tag"] as RuleCat[]).flatMap((cat) =>
                  globals[cat].map((k) => (
                    <RuleChip key={cat + ":" + k} cat={cat} ruleKey={k} onRemove={() => removeGlobalRule(cat, k)} onToggleDir={() => toggleGlobalSortDir(cat, k)} />
                  )),
                )}
                {noGlobals && (
                  <span className="k-globals__placeholder">Drag rule tokens here to apply them to your whole list.</span>
                )}
              </div>
            )}

            {/* a pinned tab is open — its scoped/global rules glow here too */}
            {effectiveActive !== "list" && activeTabObj && (
              <div className="k-tabglow" style={tintFor(activeTab)}>
                {activeTabObj.group ? (
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
                )}
              </div>
            )}

            {/* the List tab (everything inline). Browse shows all titles as
                sections; only sculpt mode surfaces the collections inline. */}
            {effectiveActive === "list" && !gridLayout && (
              <Fragment>
                {sculpt && topColls.map(renderCollection)}
                {listSections.map(renderStatusSection)}
                {sculpt && topColls.length === 0 && listSections.length === 0 && (
                  <div style={{ padding: "30px 4px", color: "var(--ink-faint)", fontSize: 13 }}>
                    Everything is pinned as a tab — drag one back down here to see it inline.
                  </div>
                )}
              </Fragment>
            )}

            {/* the List tab as a snapping grid canvas (boxes reflow, never overlap) */}
            {effectiveActive === "list" && gridLayout && (
              panelKeys.length === 0 ? (
                <div style={{ padding: "30px 4px", color: "var(--ink-faint)", fontSize: 13 }}>
                  No collections yet — make one with <b>＋ New</b> and it becomes a box you can arrange here.
                </div>
              ) : (
                <GridCanvas
                  items={panelKeys.map<GridItem>((key) => ({
                    key,
                    rows: estRows(key),
                    tint: tintFor(key),
                    node: key.startsWith("g:")
                      ? renderCollection(groupById[key.slice(2)])
                      : renderStatusSection(sectionByKey[key.slice(2)]),
                  }))}
                  editable={sculpt}
                  storageKey={GRID_KEY + id}
                  resetToken={resetToken}
                />
              )
            )}

            {/* unsorted titles float loose on the free-form canvas (Shape mode);
                always present so a title can be dropped here to unsort it */}
            {effectiveActive === "list" && gridLayout && sculpt && (
              <div className={"k-loose" + (looseTitles.length === 0 ? " k-loose--empty" : "") + ((armed && armed.type === "loose") ? " drop-armed" : "")} data-drop="loose">
                <div className="k-loose__label">
                  {looseTitles.length > 0
                    ? `Unsorted · ${looseTitles.length} loose on the canvas — drag any into a collection to file it`
                    : "Unsorted — drop a title here to remove it from its collection"}
                </div>
                {looseTitles.length > 0 && renderList(looseTitles, null)}
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
              customAxes={customAxes}
              onClose={() => setSelectedId(null)}
              onSetFeeling={setFeeling}
              onSetRateMode={setRateMode}
              onSetSymbol={setSymbol}
              onSetDim={setDim}
              onAddAxis={addAxis}
              onRemoveAxis={removeAxis}
              onSetTake={setTake}
              onRemove={removeEntryFromList}
              watched={watchedSetOf(selected)}
              onToggleWatched={toggleWatched}
              onMarkAllWatched={markAllWatched}
              onClearWatched={clearWatched}
              onSetWatched={setWatched}
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

      {/* tap-to-apply banner */}
      {pickRule && (
        <div className="k-paint-armed-banner k-pick-banner">
          Add{" "}
          <b style={{ margin: "0 2px" }}>
            {(TOKENS[pickRule.cat].find((x) => x.key === pickRule.key) || { label: "rule" }).label}
          </b>{" "}
          — tap <b style={{ margin: "0 2px" }}>Everything</b> or a collection
          <button onClick={() => setPickRule(null)}>cancel</button>
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
                  setTabbed((tt) => tt.filter((k) => k !== t.key));
                  if (activeTab === t.key) setActiveTab("list");
                  setTabDelTarget(null);
                }}
              >
                <Ico name="trash" s={13} /> Delete tab
              </button>
            </div>
          </div>
        </Fragment>
      )}
      {pendingReorder && (
        <Fragment>
          <div className="k-scrim k-scrim--modal" onClick={() => setPendingReorder(null)} />
          <div className="k-modal" role="dialog" aria-modal="true" aria-labelledby="reorder-title">
            <h3 className="k-modal__title" id="reorder-title">
              Switch to a manual order?
            </h3>
            <p className="k-modal__desc">
              {globals.group.length > 0 && globals.sort.length > 0
                ? "A grouping and a sort are currently arranging this list."
                : globals.group.length > 0
                  ? "A grouping is currently arranging this list."
                  : "A sort is currently arranging this list."}{" "}
              Dragging a title into place will turn those off and keep your own custom order from now
              on. You can re-apply a sort or grouping anytime.
            </p>
            <div className="k-modal__row">
              <button className="k-modal__btn k-modal__btn--ghost" onClick={() => setPendingReorder(null)}>
                Cancel
              </button>
              <button className="k-modal__btn" onClick={confirmReorder}>
                Use manual order
              </button>
            </div>
          </div>
        </Fragment>
      )}
    </div>
  );
}
