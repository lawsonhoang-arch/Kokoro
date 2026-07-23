"use client";

import { useRouter } from "next/navigation";

/** A compact "← Back" button. By default it steps back through history (falling
 *  back to `fallback` on a cold load with no history, e.g. a shared link); pass
 *  `onBack` to override with a custom action (the journal uses it to return to
 *  the all-entries view rather than navigate). */
export function BackButton({
  label = "Back",
  fallback = "/home",
  onBack,
  className,
}: {
  label?: string;
  fallback?: string;
  onBack?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const handle =
    onBack ??
    (() => {
      if (typeof window !== "undefined" && window.history.length > 1) router.back();
      else router.push(fallback);
    });
  return (
    <button type="button" className={"backbtn" + (className ? " " + className : "")} onClick={handle}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  );
}
