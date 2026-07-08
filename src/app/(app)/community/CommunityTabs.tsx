"use client";

import { useState, type ReactNode } from "react";

// Top-level switch for the Community page: the public discussion/review feed, or
// a timeline of what the people you follow are watching & rating.
export function CommunityTabs({
  discussions, following, followingCount,
}: {
  discussions: ReactNode;
  following: ReactNode;
  followingCount: number;
}) {
  const [tab, setTab] = useState<"discussions" | "following">("discussions");
  return (
    <>
      <nav className="subtabs" aria-label="Community sections">
        <button
          className={"subtabs__tab" + (tab === "discussions" ? " on" : "")}
          aria-pressed={tab === "discussions"}
          onClick={() => setTab("discussions")}
        >
          Discussions
        </button>
        <button
          className={"subtabs__tab" + (tab === "following" ? " on" : "")}
          aria-pressed={tab === "following"}
          onClick={() => setTab("following")}
        >
          Following {followingCount > 0 && <span className="num">{followingCount}</span>}
        </button>
      </nav>
      <div style={{ display: tab === "discussions" ? "block" : "none" }}>{discussions}</div>
      <div style={{ display: tab === "following" ? "block" : "none" }}>{following}</div>
    </>
  );
}
