"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { openNotificationsAction, unreadCountAction } from "@/app/(app)/notifications/actions";
import type { NotificationItem } from "@/lib/notifications";

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

function verb(t: NotificationItem["type"]): string {
  if (t === "like") return "liked your post";
  if (t === "reply") return "replied to your post";
  return "recommends";
}

export function NavBell({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // background poll so the badge stays live without a page reload
  useEffect(() => {
    if (open) return;
    const id = setInterval(() => {
      unreadCountAction().then(setUnread).catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, [open]);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openPanel = useCallback(() => {
    setOpen(true);
    setUnread(0); // opening marks everything read
    openNotificationsAction()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="navbell" ref={wrapRef}>
      <button
        className="site-nav__icon navbell__btn"
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        title="Notifications"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="navbell__dot">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="navbell__panel" role="dialog" aria-label="Notifications">
          <div className="navbell__head">Notifications</div>
          {items === null ? (
            <div className="navbell__empty">Loading…</div>
          ) : items.length === 0 ? (
            <div className="navbell__empty">No notifications yet.</div>
          ) : (
            <ul className="navbell__list">
              {items.map((n) => (
                <li key={n.id} className={"navbell__item" + (n.read ? "" : " navbell__item--unread")}>
                  <Link className="navbell__row" href={n.href} onClick={() => setOpen(false)}>
                    {n.actor.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="navbell__ava" src={n.actor.image} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <span className={"navbell__ava navbell__ava--gen rec-hue-" + n.actor.hue} aria-hidden="true">
                        {(n.actor.name || n.actor.username).charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="navbell__body">
                      <span className="navbell__text">
                        <b>{n.actor.name || n.actor.username}</b> {verb(n.type)}
                        {n.type === "recommend" && n.title ? <> <b className="navbell__title">{n.title.name}</b></> : null}
                      </span>
                      {n.note && <span className="navbell__note">“{n.note}”</span>}
                      <span className="navbell__time">{ago(n.at)}</span>
                    </span>
                    {n.type === "recommend" && n.title?.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="navbell__cover" src={n.title.cover} alt="" referrerPolicy="no-referrer" />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
