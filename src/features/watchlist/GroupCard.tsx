"use client";

import type { ReactNode } from "react";
import { TOKENS, CAT_LABEL, sortBaseKey, sortIsAsc, isSortReversible } from "./rules";
import { Ico } from "./Ico";
import type { Group, RuleCat, Rules } from "./types";

const CATS: RuleCat[] = ["group", "sort", "color", "tag"];

/* ---------------- RULE CHIP (applied rule summary) ---------------- */
export function RuleChip({
  cat,
  ruleKey,
  onRemove,
  onToggleDir,
}: {
  cat: RuleCat;
  ruleKey: string;
  onRemove?: () => void;
  onToggleDir?: () => void;
}) {
  const baseKey = sortBaseKey(ruleKey);
  const tok = TOKENS[cat].find((t) => t.key === baseKey);
  // custom rating axes come through as "axis-<name>" without a catalog token
  const label = tok ? tok.label : baseKey.startsWith("axis-") ? baseKey.slice(5) : baseKey;
  const showDir = cat === "sort" && isSortReversible(ruleKey);
  const asc = sortIsAsc(ruleKey);
  return (
    <span className="k-rulechip">
      <span className={"k-rulechip__dot k-rulechip__dot--" + cat} />
      {CAT_LABEL[cat]}: {label}
      {showDir && onToggleDir && (
        <button
          type="button"
          className="k-rulechip__dir"
          onClick={onToggleDir}
          title={asc ? "Ascending — click to reverse" : "Descending — click to reverse"}
          aria-label="Reverse sort direction"
        >
          {asc ? "↑" : "↓"}
        </button>
      )}
      {onRemove && (
        <span className="k-rulechip__x" onClick={onRemove} title="Remove rule">
          <Ico name="x" s={11} />
        </span>
      )}
    </span>
  );
}

/* ---------------- GROUP CARD (manual merge stack) ---------------- */
type GroupCardProps = {
  group: Group;
  children: ReactNode;
  scoped: Rules;
  armed?: boolean;
  /** briefly true right after something is dropped in — plays a receive pulse */
  landed?: boolean;
  browse: boolean;
  onRename: (gid: string, name: string) => void;
  onDissolve: (gid: string) => void;
  onRemoveRule: (gid: string, cat: RuleCat, key: string) => void;
  onToggleRule?: (gid: string, cat: RuleCat, key: string) => void;
  pinned?: boolean;
  onTogglePin?: (gid: string) => void;
  onOpen?: (gid: string) => void;
};

export function GroupCard({
  group,
  children,
  scoped,
  armed,
  landed,
  browse,
  onRename,
  onDissolve,
  onRemoveRule,
  onToggleRule,
  pinned,
  onTogglePin,
  onOpen,
}: GroupCardProps) {
  const hasScoped =
    scoped &&
    (scoped.group.length || scoped.sort.length || scoped.color.length || scoped.tag.length);

  const scopeTitle = () => {
    const parts: string[] = [];
    CATS.forEach((cat) => {
      if (scoped[cat]?.length) parts.push(cat + " = " + scoped[cat].join(", "));
    });
    return "Local rules override the global engine for this collection:\n• " + parts.join("\n• ");
  };

  return (
    <div
      className={
        "k-group" +
        (browse ? " k-group--browse" : "") +
        (armed ? " drop-armed" : "") +
        (landed ? " k-landed" : "")
      }
      data-drop="group"
      data-group-id={group.id}
      data-collid={group.id}
    >
      <div
        className={"k-group__head" + (onOpen ? " k-group__head--open" : "")}
        onClick={
          onOpen
            ? (e) => {
                // clicking the header bar opens the box; the name field, buttons
                // and rule chips keep their own clicks
                if ((e.target as HTMLElement).closest("input, button, .k-group__rules")) return;
                onOpen(group.id);
              }
            : undefined
        }
        title={onOpen ? "Open this collection" : undefined}
      >
        <input
          className="k-group__name"
          defaultValue={group.name}
          key={group.name}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => onRename(group.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        <span className="k-group__count">{group.entryIds.length}</span>
        {onTogglePin && (
          <button
            className={"k-group__pin" + (pinned ? " on" : "")}
            onClick={(e) => { e.stopPropagation(); onTogglePin(group.id); }}
            title={pinned ? "Unpin from tabs" : "Pin as a tab"}
            aria-label={pinned ? "Unpin from tabs" : "Pin as a tab"}
            aria-pressed={pinned}
          >
            <Ico name="bookmark" s={14} />
          </button>
        )}
        {onOpen && (
          <button
            className="k-group__open"
            onClick={(e) => { e.stopPropagation(); onOpen(group.id); }}
            title="Open this collection"
            aria-label="Open this collection"
          >
            <Ico name="expand" s={14} />
          </button>
        )}
        {!browse && hasScoped ? (
          <span className="k-group__scopebadge" title={scopeTitle()}>
            scoped
          </span>
        ) : null}
        <div className="k-group__rules">
          {!browse &&
            CATS.flatMap((cat) =>
              (scoped[cat] ?? []).map((k) => (
                <RuleChip
                  key={cat + ":" + k}
                  cat={cat}
                  ruleKey={k}
                  onRemove={() => onRemoveRule(group.id, cat, k)}
                  onToggleDir={onToggleRule ? () => onToggleRule(group.id, cat, k) : undefined}
                />
              )),
            )}
          <button
            className="k-group__dissolve"
            onClick={() => onDissolve(group.id)}
            title="Dissolve collection"
          >
            <Ico name="ungroup" s={15} />
          </button>
        </div>
      </div>
      <div className="k-group__rows">{children}</div>
    </div>
  );
}
