"use client";

import { useState } from "react";
import { Play, UserRound } from "lucide-react";

export function YoutubeImage({
  src,
  kind,
  eager = false,
}: {
  src?: string;
  kind: "avatar" | "banner" | "thumbnail";
  eager?: boolean;
}) {
  const [failed, setFailed] = useState<string>();
  return (
    <span className={`youtube-image youtube-image--${kind}`} aria-hidden="true">
      {kind === "avatar" && <UserRound />}
      {kind === "thumbnail" && <Play />}
      {src && failed !== src && (
        // Official thumbnails are served directly with a local fallback on failure.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading={eager ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
        />
      )}
    </span>
  );
}
