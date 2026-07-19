"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as RPE,
} from "react";
import { Ico } from "./Ico";

// ── A snapping grid canvas: boxes occupy whole grid cells, never overlap, and
// reflow (iOS-home-screen style) as you drag/resize. Auto-packs into a tidy
// layout by default and on reset. Layout persists via localStorage.

// A fine grid → gentle, small snap steps (each cell is small, so dragging nudges
// in ~40px increments instead of leaping across half the canvas).
const COLS = 24; // a box spans some of these columns
const ROW_H = 20; // px per grid row
const GAP = 12;
const DEFAULT_W = 12; // half-width by default → two boxes per row
const MIN_W = 6;
const MIN_H = 6;
// A hexagon may shrink far below a normal box: a beehive of single-title cells
// is the whole point of the square footprint.
const SQUARE_MIN_W = 3;
const SQUARE_MIN_H = 3;
const STACK_MIN_H = 140; // px — smallest useful height for a phone box

export type GRect = { x: number; y: number; w: number; h: number };
type GLayout = Record<string, GRect>;
// `full` packs the box across the whole width (its own row) — used for the
// catch-all "Unsorted" box so it sits under the collections rather than beside one.
export type GridItem = { key: string; node: ReactNode; rows: number; tint?: CSSProperties; full?: boolean;
  /** hexagons occupy a SQUARE footprint: the packer still sees a plain
   *  rectangle, the resize just locks height to match width in pixels. */
  square?: boolean };

const collides = (a: GRect, b: GRect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Nearest actually-scrollable ancestor (content overflows + overflow auto/scroll);
// null means "scroll the window/page itself". Used to auto-scroll during a drag.
export function findScroller(start: Element | null): HTMLElement | null {
  let el = start?.parentElement || null;
  while (el) {
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight - el.clientHeight > 4) return el;
    el = el.parentElement;
  }
  return null;
}

// While a finger/cursor is held near the top/bottom edge, scroll so off-screen
// drop targets become reachable (the drag handle blocks native scrolling).
export function edgeScroll(scroller: HTMLElement | null, clientY: number, edge = 80, max = 22) {
  if (scroller) {
    const r = scroller.getBoundingClientRect();
    if (clientY > r.bottom - edge) scroller.scrollTop += Math.min(max, (clientY - (r.bottom - edge)) / 2 + 5);
    else if (clientY < r.top + edge) scroller.scrollTop -= Math.min(max, (r.top + edge - clientY) / 2 + 5);
  } else {
    const vh = window.innerHeight;
    if (clientY > vh - edge) window.scrollBy(0, Math.min(max, (clientY - (vh - edge)) / 2 + 5));
    else if (clientY < edge) window.scrollBy(0, -Math.min(max, (edge - clientY) / 2 + 5));
  }
}

// vertical compaction: place boxes in reading order (row by row) and pull each
// up as far as it goes without overlapping. Boxes are ordered by their y, so the
// box being dragged flows to where its y puts it — drag it down and the others
// pack UP past it (a reorder), rather than being shoved endlessly downward.
// `fixed` (the dragged box) only wins TIES on the same row, so dragging it up
// lets it claim a taken spot and bump the occupant down.
function compact(layout: GLayout, keys: string[], fixed?: string): GLayout {
  const present = keys.filter((k) => layout[k]);
  const ordered = present.sort((ka, kb) => {
    const a = layout[ka], b = layout[kb];
    if (a.y !== b.y) return a.y - b.y;
    if (ka === fixed) return -1;
    if (kb === fixed) return 1;
    return a.x - b.x;
  });
  const placed: GRect[] = [];
  const out: GLayout = {};
  for (const k of ordered) {
    const r: GRect = { ...layout[k] };
    let y = r.y;
    while (y > 0 && !placed.some((p) => collides({ ...r, y: y - 1 }, p))) y--;
    while (placed.some((p) => collides({ ...r, y }, p))) y++;
    r.y = y;
    out[k] = r;
    placed.push(r);
  }
  return out;
}

function packFrom(items: GridItem[], startY = 0, base: GLayout = {}): GLayout {
  const out: GLayout = { ...base };
  let x = 0, y = startY, rowMax = 0;
  for (const it of items) {
    const h = Math.max(MIN_H, it.rows);
    const w = it.full ? COLS : DEFAULT_W;
    if (x + w > COLS) { x = 0; y += rowMax; rowMax = 0; }
    out[it.key] = { x, y, w, h };
    x += w;
    rowMax = Math.max(rowMax, h);
  }
  return out;
}

export function GridCanvas({
  items,
  editable,
  storageKey,
  resetToken,
}: {
  items: GridItem[];
  editable: boolean;
  storageKey: string;
  resetToken: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(1000);
  const [layout, setLayout] = useState<GLayout>({});
  // mirror of `layout` for reading the latest positions synchronously inside a
  // drag's pointermove (state is stale in that closure)
  const layoutRef = useRef<GLayout>({});
  const [dragKey, setDragKey] = useState<string | null>(null);
  // pixel offset so the box being dragged follows the cursor smoothly, while the
  // OTHERS reflow to its snapped grid cell (iOS-home-screen feel)
  const [dragTf, setDragTf] = useState<{ tx: number; ty: number } | null>(null);
  // narrow screens can't fit side-by-side boxes, so free-form collapses to a
  // single full-width column with an explicit order (kept separate from the 2D
  // desktop layout so reordering on a phone never disturbs the desktop board).
  const [mOrder, setMOrder] = useState<string[]>([]);
  // per-box heights for the phone column (px). Unset = natural height.
  const [mHeights, setMHeights] = useState<Record<string, number>>({});
  const keys = items.map((i) => i.key);
  const keySig = keys.join(",");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCw(el.clientWidth));
    ro.observe(el);
    setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // load saved layout; keep known boxes, append any new ones, drop removed ones
  useEffect(() => {
    let saved: GLayout = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch {}
    const known = new Set(keys);
    const next: GLayout = {};
    for (const k of Object.keys(saved)) if (known.has(k)) next[k] = saved[k];
    const missing = items.filter((i) => !next[i.key]);
    const maxY = Object.values(next).reduce((m, r) => Math.max(m, r.y + r.h), 0);
    const withNew = missing.length ? packFrom(missing, maxY, next) : next;
    // Reconciling persisted layout (external store) with the current box set.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayout(compact(withNew, keys));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keySig, storageKey]);

  // Turning a box into a hexagon squares it straight away, rather than leaving
  // it stretched until the next resize. Runs whenever the set of square boxes
  // changes, and only touches boxes that are not already square.
  const squareSig = items.filter((i) => i.square).map((i) => i.key).join(",");
  useEffect(() => {
    if (!cw || !squareSig) return;
    setLayout((prev) => {
      let changed = false;
      const next: GLayout = { ...prev };
      for (const k of squareSig.split(",")) {
        const r = prev[k];
        if (!r) continue;
        // A box turning into a hexagon starts at its smallest square — big
        // enough for the first card. Squaring the EXISTING width instead made
        // a half-width box balloon into a huge square. Once it is already
        // square we leave the size alone, so a resized hexagon stays put.
        const w = r.h === Math.round((pxW(r.w) + GAP) / (ROW_H + GAP)) ? r.w : MIN_W;
        const want = Math.max(SQUARE_MIN_H, Math.round((pxW(w) + GAP) / (ROW_H + GAP)));
        if (want !== r.h || w !== r.w) { next[k] = { ...r, w, h: want }; changed = true; }
      }
      if (!changed) return prev;
      const packed = compact(next, keys);
      try { localStorage.setItem(storageKey, JSON.stringify(packed)); } catch {}
      return packed;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squareSig, cw]);

  // Reset → tidy auto-pack. resetToken starts at 0 and only increments when the
  // user hits Reset; guarding on `=== 0` (rather than a "first run" ref) is safe
  // under React's double-invoked effects, which otherwise fired a spurious reset
  // on mount and clobbered the just-loaded saved layout.
  useEffect(() => {
    if (resetToken === 0) return;
    const packed = compact(packFrom(items), keys);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayout(packed);
    try { localStorage.setItem(storageKey, JSON.stringify(packed)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  // load the saved single-column (mobile) order + per-box heights. Both live
  // under their own keys so reshaping on a phone never disturbs the desktop board.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(storageKey + ":m") || "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(s)) setMOrder(s.filter((k: unknown): k is string => typeof k === "string"));
    } catch {}
    try {
      const h = JSON.parse(localStorage.getItem(storageKey + ":mh") || "{}");
      if (h && typeof h === "object" && !Array.isArray(h)) {
        const clean: Record<string, number> = {};
        for (const [k, v] of Object.entries(h)) if (typeof v === "number" && v > 0) clean[k] = v;
        setMHeights(clean);
      }
    } catch {}
  }, [storageKey]);

  const persist = (l: GLayout) => { try { localStorage.setItem(storageKey, JSON.stringify(l)); } catch {} };
  useEffect(() => { layoutRef.current = layout; }, [layout]);

  const cellW = Math.max(1, (cw - (COLS - 1) * GAP) / COLS);
  const pxX = (x: number) => x * (cellW + GAP);
  const pxY = (y: number) => y * (ROW_H + GAP);
  const pxW = (w: number) => w * cellW + (w - 1) * GAP;
  const pxH = (h: number) => h * ROW_H + (h - 1) * GAP;
  const gridRows = Object.values(layout).reduce((m, r) => Math.max(m, r.y + r.h), 0);

  const startMove = (e: RPE, key: string) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const start = layout[key];
    if (!start) return;
    const sx = e.clientX, sy = e.clientY;
    setDragKey(key);
    document.body.classList.add("k-dragging-panel");
    const move = (ev: PointerEvent) => {
      const rawDx = ev.clientX - sx, rawDy = ev.clientY - sy;
      const nx = Math.max(0, Math.min(COLS - start.w, start.x + Math.round(rawDx / (cellW + GAP))));
      const ny = Math.max(0, start.y + Math.round(rawDy / (ROW_H + GAP)));
      // Re-pack WITHOUT pinning the dragged box, so its intended y decides its
      // place in reading order — dragging it down flows the others UP past it
      // (a real reorder) instead of shoving them ever further down. The box then
      // tracks the cursor via a transform measured from its packed slot.
      const packed = compact({ ...layoutRef.current, [key]: { ...layoutRef.current[key], x: nx, y: ny } }, keys, key);
      layoutRef.current = packed;
      const slot = packed[key] || { x: nx, y: ny };
      setDragTf({ tx: rawDx - (slot.x - start.x) * (cellW + GAP), ty: rawDy - (slot.y - start.y) * (ROW_H + GAP) });
      setLayout(packed);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("k-dragging-panel");
      setDragTf(null);
      setDragKey(null);
      setLayout((prev) => { const c = compact(prev, keys); persist(c); layoutRef.current = c; return c; });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** After a resize, the box springs into its new size instead of just stopping
   *  dead — it should feel like something soft you let go of, not a rectangle
   *  that snapped. `dir` picks the wobble: a box pulled wider rebounds on the
   *  axis it was pulled along. */
  const settle = (key: string, dir: "x" | "y" | "xy") => {
    // Deferred: releasing the handle also clears dragKey, and that re-render
    // rewrites className — adding the class synchronously here would just be
    // overwritten by React's commit. Run after the flush instead.
    setTimeout(() => {
      // The body, not the item itself: .kg-item--edit carries the enter-Shape-mode
      // animation for the whole of Shape mode, and putting a second animation on
      // the same element meant that removing this class handed animation-name
      // back to that one — which restarted it from its 0% keyframe (opacity 0),
      // so every box blinked once the wobble finished.
      const el = ref.current?.querySelector(
        `.kg-item[data-key="${key}"] .kg-item__body`,
      ) as HTMLElement | null;
      if (!el) return;
      const cls = "kg-settle-" + dir;
      el.classList.remove("kg-settle-x", "kg-settle-y", "kg-settle-xy");
      void el.offsetWidth; // restart the animation when two resizes land back to back
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 480);
    }, 0);
  };

  const startResize = (e: RPE, key: string, dir: "e" | "s" | "se") => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const start = layout[key];
    if (!start) return;
    const isSquare = !!items.find((i) => i.key === key)?.square;
    const sx = e.clientX, sy = e.clientY;
    setDragKey(key);
    document.body.classList.add("k-resizing");
    const move = (ev: PointerEvent) => {
      let w = start.w, h = start.h;
      var minW = isSquare ? SQUARE_MIN_W : MIN_W;
      if (dir === "e" || dir === "se") w = Math.max(minW, Math.min(COLS - start.x, start.w + Math.round((ev.clientX - sx) / (cellW + GAP))));
      if (dir === "s" || dir === "se") h = Math.max(MIN_H, start.h + Math.round((ev.clientY - sy) / (ROW_H + GAP)));
      // A hexagon keeps a square footprint, so one drag scales both axes: the
      // packer still sees an ordinary rectangle and nothing else has to change.
      // For a pure vertical drag we go the other way and derive the width.
      if (isSquare) {
        if (dir === "s") w = Math.max(minW, Math.min(COLS - start.x, Math.round((pxH(h) + GAP) / (cellW + GAP))));
        h = Math.max(SQUARE_MIN_H, Math.round((pxW(w) + GAP) / (ROW_H + GAP)));
      }
      setLayout((prev) => compact({ ...prev, [key]: { ...prev[key], w, h } }, keys, key));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("k-resizing");
      setDragKey(null);
      setLayout((prev) => { const c = compact(prev, keys); persist(c); return c; });
      settle(key, dir === "e" ? "x" : dir === "s" ? "y" : "xy");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ── Single-column (phone) mode: full-width boxes at natural height, reordered
  // by dragging each box's handle (touch-action:none so the drag isn't stolen by
  // the page scroll). The list reflows live as the handle crosses a neighbour.
  const narrow = cw > 0 && cw < 560;
  if (narrow) {
    const idx = new Map(mOrder.map((k, i) => [k, i] as const));
    const ordered = [...items].sort((a, b) => {
      const ia = idx.has(a.key) ? idx.get(a.key)! : Infinity;
      const ib = idx.has(b.key) ? idx.get(b.key)! : Infinity;
      if (ia !== ib) return ia - ib;
      const ra = layout[a.key], rb = layout[b.key];
      return ra && rb ? ra.y - rb.y || ra.x - rb.x : 0;
    });
    const startStackDrag = (e: RPE, key: string) => {
      if (!editable) return;
      e.preventDefault();
      setDragKey(key);
      document.body.classList.add("k-dragging-panel");
      // Collapse every box to a compact header while reordering, so the whole
      // set fits on screen and you can drag one past another without the boxes
      // (which can each be taller than the viewport) forcing endless scrolling.
      ref.current?.classList.add("kg--reordering");
      // Each frame we: (1) follow the finger with a transform so the box visibly
      // drags; (2) auto-scroll near the edges (for long lists); (3) reorder live
      // as the finger crosses a neighbour. Follow re-measures each frame, so it
      // stays locked to the finger through both scrolling and reordering.
      const scroller = findScroller(ref.current);
      const draggedEl = () =>
        (ref.current?.querySelector(`.kg-item--stack[data-key="${key}"]`) as HTMLElement | null) || null;
      let grabDy = 0;
      { const el = draggedEl(); if (el) grabDy = e.clientY - el.getBoundingClientRect().top; }
      let lastY = e.clientY;
      let curTf = 0;
      let raf = 0;
      const applyReorder = (clientY: number) => {
        const container = ref.current;
        if (!container) return;
        const els = [...container.querySelectorAll<HTMLElement>(".kg-item--stack")];
        const others = els.map((el) => el.dataset.key || "").filter((k) => k && k !== key);
        let insert = others.length;
        for (const el of els) {
          const k = el.dataset.key || "";
          if (!k || k === key) continue;
          const r = el.getBoundingClientRect();
          // Reorder as soon as the finger passes into the top of the next box,
          // capped at 90px — a box can be taller than the screen, so waiting for
          // its true midpoint would make it unreachable without lots of scrolling.
          if (clientY < r.top + Math.min(r.height / 2, 90)) { insert = others.indexOf(k); break; }
        }
        const next = [...others];
        next.splice(insert, 0, key);
        // only re-render when the order actually changes (this runs every frame)
        setMOrder((prev) =>
          prev.length === next.length && prev.every((k, i) => k === next[i]) ? prev : next,
        );
      };
      const follow = () => {
        const el = draggedEl();
        if (!el) return;
        // chase: nudge the transform so the box top sits at (finger − grab offset)
        curTf += (lastY - grabDy) - el.getBoundingClientRect().top;
        el.style.transform = `translateY(${curTf}px)`;
      };
      const tick = () => {
        edgeScroll(scroller, lastY);
        applyReorder(lastY);
        follow();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      const move = (ev: PointerEvent) => { lastY = ev.clientY; };
      const up = () => {
        cancelAnimationFrame(raf);
        const el = draggedEl();
        if (el) el.style.transform = "";
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        document.body.classList.remove("k-dragging-panel");
        ref.current?.classList.remove("kg--reordering");
        setDragKey(null);
        setMOrder((cur) => {
          try { localStorage.setItem(storageKey + ":m", JSON.stringify(cur)); } catch {}
          return cur;
        });
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    };
    // Phone reshaping is limited to HEIGHT (the column is always full-width):
    // drag the bottom edge to show more or less of a box. Stored per-box under
    // its own key, so it never touches the desktop board's 2D layout.
    const startStackResize = (e: RPE, key: string) => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
      const bodyEl = ref.current?.querySelector(
        `.kg-item--stack[data-key="${key}"] .kg-item__body`,
      ) as HTMLElement | null;
      const startH = bodyEl ? bodyEl.getBoundingClientRect().height : 240;
      const sy = e.clientY;
      document.body.classList.add("k-resizing");
      const move = (ev: PointerEvent) => {
        const h = Math.max(STACK_MIN_H, Math.round(startH + (ev.clientY - sy)));
        setMHeights((prev) => (prev[key] === h ? prev : { ...prev, [key]: h }));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        document.body.classList.remove("k-resizing");
        setMHeights((cur) => {
          try { localStorage.setItem(storageKey + ":mh", JSON.stringify(cur)); } catch {}
          return cur;
        });
        settle(key, "y"); // mobile only resizes height
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    };
    // double-tap the handle clears the height back to natural (show everything)
    const clearStackHeight = (key: string) =>
      setMHeights((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        try { localStorage.setItem(storageKey + ":mh", JSON.stringify(next)); } catch {}
        return next;
      });
    return (
      <div ref={ref} className="kg kg--stack">
        {ordered.map((it, i) => {
          const h = mHeights[it.key];
          return (
            <div key={it.key} data-key={it.key} className={"kg-item kg-item--stack" + (dragKey === it.key ? " kg-item--dragging" : "")}>
              {editable && (
                <div
                  className="kg-move kg-move--stack"
                  onPointerDown={(e) => startStackDrag(e, it.key)}
                  title="Drag to reorder this box"
                >
                  <span className="kg-move__pill"><Ico name="move" s={12} /> Box {i + 1} · drag to move</span>
                </div>
              )}
              <div
                className={"kg-item__body k-panel" + (h ? " is-sized" : "")}
                style={h ? { ...it.tint, height: h } : it.tint}
              >
                {it.node}
              </div>
              {editable && (
                <div
                  className="kg-rz--stack"
                  onPointerDown={(e) => startStackResize(e, it.key)}
                  onDoubleClick={() => clearStackHeight(it.key)}
                  title="Drag to set this box's height · double-tap to fit contents"
                  aria-label="Resize box height"
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={ref} className="kg" style={{ height: pxY(gridRows) - GAP + (gridRows ? 0 : 0) }}>
      {items.map((it) => {
        const r = layout[it.key];
        if (!r) return null;
        const active = dragKey === it.key;
        return (
          <div
            key={it.key}
            data-key={it.key}
            className={"kg-item" + (active ? " kg-item--active" : "") + (editable ? " kg-item--edit" : "")}
            style={{
              left: pxX(r.x),
              top: pxY(r.y),
              width: pxW(r.w),
              height: pxH(r.h),
              transform: active && dragTf ? `translate(${dragTf.tx}px, ${dragTf.ty}px)` : undefined,
              transition: active
                ? "none"
                : "left .42s cubic-bezier(.33,1,.68,1), top .42s cubic-bezier(.33,1,.68,1), width .3s cubic-bezier(.33,1,.68,1), height .3s cubic-bezier(.33,1,.68,1), transform .42s cubic-bezier(.33,1,.68,1)",
            }}
          >
            {editable && (
              <div className="kg-move" onPointerDown={(e) => startMove(e, it.key)} title="Drag to move this box">
                <span className="kg-move__pill"><Ico name="move" s={12} /> Move</span>
              </div>
            )}
            <div className="kg-item__body k-panel" style={it.tint}>{it.node}</div>
            {editable && (
              <>
                <span className="kg-rz kg-rz--e" onPointerDown={(e) => startResize(e, it.key, "e")} title="Drag to widen" />
                <span className="kg-rz kg-rz--s" onPointerDown={(e) => startResize(e, it.key, "s")} title="Drag to grow taller" />
                <span className="kg-rz kg-rz--se" onPointerDown={(e) => startResize(e, it.key, "se")} title="Drag to resize" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
