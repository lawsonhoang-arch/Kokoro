"use client";

import { useEffect, useState } from "react";

// A shareable "add me" link — points at your public profile, where anyone on
// Kokoro can follow you. Uses the native share sheet on mobile, else copies.
export function InviteCard({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);
  const [host, setHost] = useState(""); // real host, resolved after mount
  const path = `/u/${encodeURIComponent(username)}`;
  const pretty = `${host || "kokoro"}/u/${username}`;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(window.location.host);
  }, []);

  const share = async () => {
    const url = `${window.location.origin}${path}`;
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: "Add me on Kokoro", text: "Follow my anime & manga taste on Kokoro:", url });
        return;
      } catch { /* cancelled — fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className="ppl-invite">
      <div className="ppl-invite__txt">
        <div className="ppl-invite__title">Invite a friend</div>
        <div className="ppl-invite__sub">Share your profile link — anyone on Kokoro can follow you from it.</div>
        <code className="ppl-invite__link">{pretty}</code>
      </div>
      <button className="ppl-invite__btn" onClick={share}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        {copied ? "Copied!" : "Share link"}
      </button>
    </div>
  );
}
