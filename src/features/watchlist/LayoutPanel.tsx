"use client";

import { useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { Ico } from "./Ico";
import type { Rect } from "./types";

const GRID = 8; // light snap so boxes align without feeling rigid
const MIN_W = 220;
const MIN_H = 150;
const snap = (n: number) => Math.round(n / GRID) * GRID;

const CURSORS: Record<string, string> = {
  n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
  ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize",
};

const DIRS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

type Props = {
  panelKey: string;
  rect: Rect;
  onMove: (key: string, partial: Partial<Rect>) => void;
  onResize: (key: string, partial: Partial<Rect>) => void;
  onFront: (key: string) => void;
  readOnly: boolean;
  children: ReactNode;
};

export function LayoutPanel({ panelKey, rect, onMove, onResize, onFront, readOnly, children }: Props) {
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
    const move = (ev: PointerEvent) => {
      onMove(panelKey, {
        x: Math.max(0, snap(ox + (ev.clientX - sx))),
        y: Math.max(0, snap(oy + (ev.clientY - sy))),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("k-dragging-panel");
      setActive(null);
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
    const move = (ev: PointerEvent) => {
      const ddx = ev.clientX - sx;
      const ddy = ev.clientY - sy;
      let nx = o.x;
      let ny = o.y;
      let nw = o.w;
      let nh = o.h;
      if (R) nw = o.w + ddx;
      if (L) {
        nw = o.w - ddx;
        nx = o.x + ddx;
      }
      if (B) nh = o.h + ddy;
      if (T) {
        nh = o.h - ddy;
        ny = o.y + ddy;
      }
      if (nw < MIN_W) {
        if (L) nx -= MIN_W - nw;
        nw = MIN_W;
      }
      if (nh < MIN_H) {
        if (T) ny -= MIN_H - nh;
        nh = MIN_H;
      }
      nw = snap(nw);
      nh = snap(nh);
      nx = Math.max(0, snap(nx));
      ny = Math.max(0, snap(ny));
      onResize(panelKey, { x: nx, y: ny, w: nw, h: nh });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("k-resizing");
      document.body.style.cursor = "";
      setActive(null);
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
      <div className="k-panel__move" onPointerDown={startMove} title="Drag to move">
        <span className="k-panel__movepill">
          <Ico name="move" s={13} />
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
