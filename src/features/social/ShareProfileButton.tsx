"use client";

import { useState } from "react";

const ShareIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);

// Share a public recap of your profile. Uses the native share sheet where
// available (mobile), else copies the link.
export function ShareProfileButton({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/share/${encodeURIComponent(username)}`;
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: "My taste on Kokoro", text: "Here's my anime & manga taste on Kokoro:", url });
        return;
      } catch { /* cancelled or unsupported — fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* clipboard blocked */ }
  };

  return (
    <button className="pf-share" onClick={share} title="Share a public recap of your profile">
      <ShareIcon />
      {copied ? "Link copied!" : "Share profile"}
    </button>
  );
}
