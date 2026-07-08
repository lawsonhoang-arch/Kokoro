"use client";

import { useState } from "react";

// A lightweight YouTube "lite" embed: shows the thumbnail with a play button
// and only mounts the (heavy, cookie-setting) player iframe once the user
// clicks. Uses youtube-nocookie for privacy.
export function TrailerEmbed({ id }: { id: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="ytbox">
      {playing ? (
        <iframe
          className="ytbox__frame"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title="Trailer"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button className="ytbox__poster" type="button" onClick={() => setPlaying(true)} aria-label="Play trailer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="ytbox__thumb"
            src={`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`}
            onError={(e) => {
              // maxres isn't generated for every video — fall back to hqdefault
              const el = e.currentTarget;
              if (!el.dataset.fallback) {
                el.dataset.fallback = "1";
                el.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
              }
            }}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          <span className="ytbox__play" aria-hidden="true">
            <svg viewBox="0 0 68 48" width="68" height="48">
              <path d="M66.5 7.7a8 8 0 0 0-5.6-5.7C56 .6 34 .6 34 .6S12 .6 7.1 2a8 8 0 0 0-5.6 5.7A83.6 83.6 0 0 0 0 24a83.6 83.6 0 0 0 1.5 16.3 8 8 0 0 0 5.6 5.7C12 47.4 34 47.4 34 47.4s22 0 26.9-1.4a8 8 0 0 0 5.6-5.7A83.6 83.6 0 0 0 68 24a83.6 83.6 0 0 0-1.5-16.3z" fill="#f00" />
              <path d="M27 34.5 45 24 27 13.5z" fill="#fff" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
