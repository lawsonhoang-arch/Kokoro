"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from "react";
import { TOKENS, type Token } from "./rules";
import { Ico } from "./Ico";
import type { Group, PaintState, RuleCat, Rules } from "./types";

const SECTIONS: { cat: RuleCat; title: string; hint: string; paint?: boolean }[] = [
  { cat: "group", title: "Group titles by", hint: "Splits your list into automatic sections." },
  { cat: "sort", title: "Sort titles by", hint: "Orders titles. Stack multiple for tiebreakers." },
  { cat: "color", title: "Color rows by", hint: "A thin stripe reflects this value.", paint: true },
  { cat: "tag", title: "Show as tags", hint: "Small pills on each row. Stack as many as you like.", paint: true },
];

const TOKEN_ICON: Record<string, string> = {
  status: "status", feeling: "heart", genre: "tag", length: "ep", seasons: "stack",
  az: "az", watched: "calendar", rating: "star", random: "shuffle", episodes: "ep",
};
function iconForToken(cat: RuleCat, key: string): string {
  if (cat === "tag" && key === "seasons") return "stack";
  if (cat === "tag" && key === "episodes") return "ep";
  return TOKEN_ICON[key] || (cat === "color" ? "circle" : "dot");
}

function TokenIcon({ name, s = 13 }: { name: string; s?: number }) {
  const p = {
    width: s, height: s, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  const M: Record<string, ReactNode> = {
    status: <><circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="6" cy="18" r="2.6" /><line x1="12" y1="6" x2="20" y2="6" /><line x1="12" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" /></>,
    heart: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
    tag: <><path d="M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8-8-8z" /><circle cx="8.5" cy="8.5" r="1.2" /></>,
    ep: <><rect x="3" y="6" width="18" height="12" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    stack: <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>,
    az: <><path d="M4 18l4-10 4 10" /><path d="M5 15h6" /><path d="M14 8h5l-5 10h5" /></>,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><line x1="4" y1="9" x2="20" y2="9" /><line x1="9" y1="3" x2="9" y2="7" /><line x1="15" y1="3" x2="15" y2="7" /></>,
    star: <path d="M12 3l2.7 5.6 6.2.9-4.5 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3 9.5l6.2-.9L12 3z" />,
    shuffle: <><path d="M16 4h4v4" /><path d="M16 20h4v-4" /><path d="M4 4l16 16" /><path d="M20 4L4 20" /></>,
    circle: <circle cx="12" cy="12" r="6.5" />,
    dot: <circle cx="12" cy="12" r="3" />,
  };
  return <svg {...p}>{M[name] || M.dot}</svg>;
}

// counts how many places (globals + each scoped collection) have this token
function countApplied(globals: Rules, groups: Group[], cat: RuleCat, key: string): number {
  let n = (globals[cat] || []).includes(key) ? 1 : 0;
  groups.forEach((g) => {
    if ((g.scoped?.[cat] || []).includes(key)) n += 1;
  });
  return n;
}

function RuleRow({
  cat,
  tok,
  paintable,
  activeCount,
  paintArmed,
  onGrab,
  onPaint,
}: {
  cat: RuleCat;
  tok: Token;
  paintable: boolean;
  activeCount: number;
  paintArmed: boolean;
  onGrab: (e: RPointerEvent, cat: RuleCat, key: string) => void;
  onPaint: (cat: RuleCat, key: string) => void;
}) {
  return (
    <div
      className={"k-rrow" + (activeCount > 0 ? " applied" : "") + (paintArmed ? " painting" : "")}
      data-token="1"
      data-token-cat={cat}
      data-token-key={tok.key}
      onPointerDown={(e) => onGrab(e, cat, tok.key)}
      title={
        paintArmed
          ? "Painting — tap entries to apply, or click the brush again to stop"
          : "Drag onto Everything or a collection to apply"
      }
    >
      <span className="k-rrow__grip" aria-hidden="true">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
          <circle cx="2.5" cy="3" r="1.1" /><circle cx="7.5" cy="3" r="1.1" />
          <circle cx="2.5" cy="7" r="1.1" /><circle cx="7.5" cy="7" r="1.1" />
          <circle cx="2.5" cy="11" r="1.1" /><circle cx="7.5" cy="11" r="1.1" />
        </svg>
      </span>

      <span className={"k-rrow__icon k-rrow__icon--" + cat} aria-hidden="true">
        <TokenIcon name={iconForToken(cat, tok.key)} s={13} />
      </span>

      <span className="k-rrow__label">{tok.label}</span>

      {activeCount > 0 && (
        <span className="k-rrow__count" title={activeCount === 1 ? "Applied to 1 place" : `Applied to ${activeCount} places`}>
          {activeCount}
        </span>
      )}

      {paintable && (
        <button
          className={"k-rrow__paint" + (paintArmed ? " on" : "")}
          title={paintArmed ? "Painting active — click the brush to stop" : "Paint this rule onto entries one by one"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPaint(cat, tok.key);
          }}
        >
          <Ico name="brush" s={13} />
        </button>
      )}
    </div>
  );
}

type SidebarProps = {
  onGrabToken: (e: RPointerEvent, cat: RuleCat, key: string) => void;
  onPaint: (cat: RuleCat, key: string) => void;
  paintState: PaintState;
  globals: Rules;
  groups: Group[];
  customAxes?: string[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function SculptSidebar({
  onGrabToken,
  onPaint,
  paintState,
  globals,
  groups = [],
  customAxes = [],
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  // Custom rating axes are extra dimensions, so they sort just like a rating —
  // append them to the Sort tokens (the comparator already handles axis-<name>).
  const tokensFor = (cat: RuleCat): Token[] =>
    cat === "sort"
      ? [...TOKENS.sort, ...customAxes.map((a) => ({ key: "axis-" + a, label: a }))]
      : TOKENS[cat] || [];
  // One category open at a time. As a top bar the palette is short and wide, and
  // showing all four at once (Sort alone has a dozen tokens) meant most of it sat
  // behind a scroll. Picking a category keeps every token of it in view at once.
  const [open, setOpen] = useState<Record<RuleCat, boolean>>({
    group: true, sort: false, color: false, tag: false,
  });
  const toggleOpen = (cat: RuleCat) =>
    setOpen((o) => ({
      group: false, sort: false, color: false, tag: false,
      [cat]: !o[cat],
    }));

  if (collapsed) {
    const totals = SECTIONS.map((sec) => ({
      cat: sec.cat,
      count: tokensFor(sec.cat).reduce((sum, t) => sum + countApplied(globals, groups, sec.cat, t.key), 0),
    }));
    return (
      <aside className="k-sidebar k-sidebar--collapsed" aria-label="Sculpt sidebar (collapsed)">
        <button className="k-sidebar__expand" onClick={onToggleCollapsed} title="Expand sculpt sidebar">
          <Ico name="chev" s={16} />
        </button>
        <div className="k-sidebar__rail">
          {totals.map(({ cat, count }) => (
            <button
              key={cat}
              className={"k-sidebar__railsec" + (count > 0 ? " on" : "")}
              onClick={onToggleCollapsed}
              title={(SECTIONS.find((s) => s.cat === cat)?.title ?? "") + (count ? ` — ${count} active` : "")}
            >
              <span className={"k-rsec__dot k-rsec__dot--" + cat} />
              {count > 0 && <span className="k-sidebar__railcount">{count}</span>}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="k-sidebar">
      <div className="k-sidebar__head">
        <button className="k-sidebar__collapse" onClick={onToggleCollapsed} title="Collapse sidebar to recover screen space">
          <Ico name="chev" s={16} />
        </button>
        <div className="k-sidebar__eyebrow">Sculpt</div>
        <div className="k-sidebar__title">Organize your list</div>
        <div className="k-sidebar__hint">
          Drag any rule onto <b>Everything</b> to apply it globally, or onto a <b>collection</b> to
          scope it there. Stack as many as you like — they coexist.
        </div>
      </div>

      <div className="k-sidebar__body">
        {SECTIONS.map((sec) => {
          const tokens = tokensFor(sec.cat);
          const sectionActive = tokens.reduce((sum, t) => sum + countApplied(globals, groups, sec.cat, t.key), 0);
          return (
            <section key={sec.cat} className={"k-rsec" + (open[sec.cat] ? " open" : " closed")}>
              <button className="k-rsec__head" onClick={() => toggleOpen(sec.cat)} aria-expanded={open[sec.cat]}>
                <span className={"k-rsec__dot k-rsec__dot--" + sec.cat} />
                <span className="k-rsec__title">{sec.title}</span>
                {sectionActive > 0 && (
                  <span className="k-rsec__count" title={`${sectionActive} active`}>
                    {sectionActive}
                  </span>
                )}
                <span className="k-rsec__chev">
                  <Ico name="chev" s={12} />
                </span>
              </button>
              {open[sec.cat] && (
                <div className="k-rsec__body">
                  <p className="k-rsec__hint">{sec.hint}</p>
                  <div className="k-rrows">
                    {tokens.map((tok) => (
                      <RuleRow
                        key={tok.key}
                        cat={sec.cat}
                        tok={tok}
                        paintable={!!sec.paint}
                        activeCount={countApplied(globals, groups, sec.cat, tok.key)}
                        paintArmed={!!paintState && paintState.cat === sec.cat && paintState.key === tok.key}
                        onGrab={onGrabToken}
                        onPaint={onPaint}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="k-sidebar__foot">
        <span className="k-sidebar__footdot" />
        <span>
          <b>Tip:</b> tokens stack. Two sort tokens? The second breaks ties. Two color tokens? The
          first wins.
        </span>
      </div>
    </aside>
  );
}

/* ---------------- SEGMENTED TOGGLE (sliding indicator) ---------------- */
type SegOption<T extends string> = { value: T; label: ReactNode; icon?: ReactNode; title?: string };

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegOption<T>[];
  ariaLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ left: 0, width: 0, ready: false });
  useLayoutEffect(() => {
    const recalc = () => {
      const c = ref.current;
      if (!c) return;
      const btn = c.querySelector<HTMLButtonElement>(`button[data-val="${value}"]`);
      if (!btn) return;
      const cr = c.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      setInd({ left: br.left - cr.left, width: br.width, ready: true });
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [value, options]);
  return (
    <div className={"k-viewseg" + (className ? " " + className : "")} ref={ref} role="group" aria-label={ariaLabel}>
      <span
        className="k-viewseg__indicator"
        aria-hidden="true"
        style={{ left: ind.left, width: ind.width, opacity: ind.ready ? 1 : 0 }}
      />
      {options.map((o) => (
        <button key={o.value} data-val={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)} title={o.title}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
