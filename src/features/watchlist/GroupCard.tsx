"use client";

import type { PointerEvent as RPointerEvent, ReactNode } from "react";
import { TOKENS, CAT_LABEL } from "./rules";
import { Ico } from "./Ico";
import type { Group, RuleCat, Rules } from "./types";

const CATS: RuleCat[] = ["group", "sort", "color", "tag"];

/* ---------------- RULE CHIP (applied rule summary) ---------------- */
export function RuleChip({
  cat,
  ruleKey,
  onRemove,
}: {
  cat: RuleCat;
  ruleKey: string;
  onRemove?: () => void;
}) {
  const tok = TOKENS[cat].find((t) => t.key === ruleKey);
  return (
    <span className="k-rulechip">
      <span className={"k-rulechip__dot k-rulechip__dot--" + cat} />
      {CAT_LABEL[cat]}: {tok ? tok.label : ruleKey}
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
  nestArmed?: boolean;
  browse: boolean;
  onRename: (gid: string, name: string) => void;
  onDissolve: (gid: string) => void;
  onRemoveRule: (gid: string, cat: RuleCat, key: string) => void;
  onGrabHead?: (e: RPointerEvent, gid: string) => void;
};

export function GroupCard({
  group,
  children,
  scoped,
  armed,
  nestArmed,
  browse,
  onRename,
  onDissolve,
  onRemoveRule,
  onGrabHead,
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
        (nestArmed ? " nest-armed" : "")
      }
      data-drop="group"
      data-group-id={group.id}
      data-collid={group.id}
    >
      <div className="k-group__head">
        <span
          className="k-group__grip"
          onPointerDown={(e) => onGrabHead && onGrabHead(e, group.id)}
          title="Drag to pin as a tab, nest inside another collection, or drop into the list"
        >
          <Ico name="grip" s={14} />
        </span>
        <input
          className="k-group__name"
          defaultValue={group.name}
          key={group.name}
          onBlur={(e) => onRename(group.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        <span className="k-group__count">{group.entryIds.length}</span>
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
