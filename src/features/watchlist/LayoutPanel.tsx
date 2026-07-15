"use client";

import { useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { Ico } from "./Ico";
import type { Rect, Guide } from "./types";

const GRID = 8; // light grid snap so boxes align without feeling rigid
const MIN_W = 220;
const MIN_H = 150;
const SNAP = 8; // alignment-snap threshold (px) to a neighbour's edge/centre
const snap = (n: number) => Math.round(n / GRID) * GRID;

const CURSORS: Record<string, string> = {
  n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
  ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize",
};

const DIRS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

// Candidate snap lines on each axis: the canvas edges/centre + every sibling's
// left/centre/right (x) or top/centre/bottom (y). Recognising these is what lets
// free dragging fall into clean rows, columns, and grids on its own.
function targetsX(siblings: Rect[], canvasW: number): number[] {
  const t = [0, Math.round(canvasW / 2), canvasW];
  for (const s of siblings) t.push(s.x, Math.round(s.x + s.w / 2), s.x + s.w);
  return t;
}
function targetsY(siblings: Rect[]): number[] {
  const t = [0];
  for (const s of siblings) t.push(s.y, Math.round(s.y + s.h / 2), s.y + s.h);
  return t;
}
/** Nearest target within SNAP for any of my candidate edges → the delta to shift
 *  and the line to draw. */
function bestSnap(myEdges: number[], targets: number[]): { delta: number; line: number } | null {
  let best: { delta: number; line: number } | null = null;
  for (const e of myEdges) {
    for (const t of targets) {
      const d = t - e;
      if (Math.abs(d) <= SNAP && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, line: t };
    }
  }
  return best;
}

type Props = {
  panelKey: string;
  rect: Rect;
  siblings: Rect[];
  canvasW: number;
  onMove: (key: string, partial: Partial<Rect>) => void;
  onResize: (key: string, partial: Partial<Rect>) => void;
  onFront: (key: string) => void;
  onGuides: (guides: Guide[]) => void;
  readOnly: boolean;
  children: ReactNode;
};

export function LayoutPanel({ panelKey, rect, siblings, canvasW, onMove, onResize, onFront, onGuides, readOnly, children }: Props) {
  const { x, y, w, h, z } = rect;
  const [active, setActive] = useState<string | null>(null);

  if (readOnly) {
    return (
      <div
        className="k-panel k-panel--ro"
        data-panel-key={panelKey}
        style={{ left: x, top: y, width: w, height: h, zIndex: z || 1 }}
      >
        {children}
      </div>
    );
  }

  const startMove = (e: RPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFront(panelKey);
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = x;
    const oy = y;
    setActive("move");
    document.body.classList.add("k-dragging-panel");
    const xs = targetsX(siblings, canvasW);
    const ys = targetsY(siblings);
    const move = (ev: PointerEvent) => {
      const rawX = Math.max(0, ox + (ev.clientX - sx));
      const rawY = Math.max(0, oy + (ev.clientY - sy));
      const guides: Guide[] = [];
      // align my left / centre / right to a target column, else fall to grid
      const sX = bestSnap([rawX, rawX + w / 2, rawX + w], xs);
      const nx = sX ? Math.max(0, rawX + sX.delta) : snap(rawX);
      if (sX) guides.push({ o: "v", pos: sX.line });
      const sY = bestSnap([rawY, rawY + h / 2, rawY + h], ys);
      const ny = sY ? Math.max(0, rawY + sY.delta) : snap(rawY);
      if (sY) guides.push({ o: "h", pos: sY.line });
      onMove(panelKey, { x: nx, y: ny });
      onGuides(guides);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("k-dragging-panel");
      setActive(null);
      onGuides([]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (e: RPointerEvent, dir: string) => {
    e.preventDefault();
    e.stopPropagation();
    onFront(panelKey);
    const sx = e.clientX;
    const sy = e.clientY;
    const o = { x, y, w, h };
    const L = dir.includes("w");
    const R = dir.includes("e");
    const T = dir.includes("n");
    const B = dir.includes("s");
    setActive(dir);
    document.body.classList.add("k-resizing");
    document.body.style.cursor = CURSORS[dir];
    const xs = targetsX(siblings, canvasW);
    const ys = targetsY(siblings);
    const move = (ev: PointerEvent) => {
      const ddx = ev.clientX - sx;
      const ddy = ev.clientY - sy;
      let nx = o.x;
      let ny = o.y;
      let nw = o.w;
      let nh = o.h;
      if (R) nw = o.w + ddx;
      if (L) { nw = o.w - ddx; nx = o.x + ddx; }
      if (B) nh = o.h + ddy;
      if (T) { nh = o.h - ddy; ny = o.y + ddy; }
      const guides: Guide[] = [];
      // snap the moving edge(s) to a neighbour's edge, else grid-snap
      if (R) { const s = bestSnap([nx + nw], xs); if (s) { nw = s.line - nx; guides.push({ o: "v", pos: s.line }); } else nw = snap(nw); }
      if (L) { const s = bestSnap([nx], xs); if (s) { nw -= s.delta; nx = s.line; guides.push({ o: "v", pos: s.line }); } else { const g = snap(nx); nw += nx - g; nx = g; } }
      if (B) { const s = bestSnap([ny + nh], ys); if (s) { nh = s.line - ny; guides.push({ o: "h", pos: s.line }); } else nh = snap(nh); }
      if (T) { const s = bestSnap([ny], ys); if (s) { nh -= s.delta; ny = s.line; guides.push({ o: "h", pos: s.line }); } else { const g = snap(ny); nh += ny - g; ny = g; } }
      if (nw < MIN_W) { if (L) nx -= MIN_W - nw; nw = MIN_W; }
      if (nh < MIN_H) { if (T) ny -= MIN_H - nh; nh = MIN_H; }
      nx = Math.max(0, nx);
      ny = Math.max(0, ny);
      onResize(panelKey, { x: nx, y: ny, w: nw, h: nh });
      onGuides(guides);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("k-resizing");
      document.body.style.cursor = "";
      setActive(null);
      onGuides([]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className={"k-panel" + (active ? " k-panel--active" : "")}
      data-panel-key={panelKey}
      style={{ left: x, top: y, width: w, height: h, zIndex: z || 1 }}
      onPointerDown={() => onFront(panelKey)}
    >
      <div className="k-panel__move" onPointerDown={startMove} title="Drag to move this box">
        <span className="k-panel__movepill">
          <Ico name="move" s={12} /> Move
        </span>
      </div>

      {children}

      {DIRS.map((d) => (
        <span
          key={d}
          className={"k-rz k-rz--" + d}
          data-on={active === d ? "1" : undefined}
          onPointerDown={(e) => startResize(e, d)}
        />
      ))}
    </div>
  );
}
