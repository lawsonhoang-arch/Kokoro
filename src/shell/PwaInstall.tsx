"use client";

import { useEffect, useState } from "react";

// beforeinstallprompt isn't in the TS DOM lib
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "kokoro_pwa_dismissed";

/** Registers the service worker and offers an "Install Kokoro" prompt.
 *  - Chrome/Android/desktop: captures beforeinstallprompt and shows a banner
 *    whose button fires the native install dialog.
 *  - iOS Safari (no such event): shows the manual "Add to Home Screen" hint.
 *  Hidden once installed (standalone) or after the user dismisses/installs. */
export function PwaInstall() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const installed =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (installed) return;

    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch {}
    if (dismissed) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    const onInstalled = () => {
      setShow(false);
      setDeferred(null);
      try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari can install but never fires beforeinstallprompt — hint instead.
    // Deferred so it's not a synchronous setState in the effect body.
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)) {
      queueMicrotask(() => { setIosHint(true); setShow(true); });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch { /* user closed it */ }
    setDeferred(null);
    dismiss();
  };

  if (!show) return null;
  return (
    <div className="pwa-banner" role="dialog" aria-label="Install Kokoro">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pwa-banner__icon" src="/icon-192.png" alt="" width={40} height={40} />
      <div className="pwa-banner__text">
        <strong>Install Kokoro</strong>
        <span>
          {iosHint
            ? "Tap the Share button, then “Add to Home Screen”."
            : "Add it to your home screen for a full-screen, app-like experience."}
        </span>
      </div>
      {!iosHint && (
        <button type="button" className="pwa-banner__btn" onClick={install}>Install</button>
      )}
      <button type="button" className="pwa-banner__x" onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
