"use client";

import { useState } from "react";
import type { SocialLink } from "@/lib/social-links";

export function PublicProfileLinks({
  path,
  social,
  portfolioUrl,
}: {
  path: string | null;
  social: SocialLink | null;
  portfolioUrl?: string;
}) {
  const [showVideo, setShowVideo] = useState(false);
  const [share, setShare] = useState("");
  const [copied, setCopied] = useState(false);
  if (!path) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="inline">
        {social && (
          <a
            className="button outline small"
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            SNS 원본 ↗
          </a>
        )}
        {portfolioUrl && (
          <a
            className="button outline small"
            href={portfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            포트폴리오 ↗
          </a>
        )}
        {social?.videoId && (
          <button
            className="button outline small"
            type="button"
            aria-expanded={showVideo}
            onClick={() => setShowVideo(!showVideo)}
          >
            {showVideo ? "YouTube 영상 닫기" : "YouTube 플레이어 연결"}
          </button>
        )}
        <button
          className="button outline small"
          type="button"
          onClick={async () => {
            const url = new URL(path, location.origin).href;
            try {
              await navigator.clipboard.writeText(url);
              setShare("");
              setCopied(true);
            } catch {
              setCopied(false);
              setShare(url);
            }
          }}
        >
          공유 링크 복사
        </button>
      </div>
      {copied && <p role="status">공유 링크를 복사했습니다.</p>}
      {share && (
        <label className="field">
          공유 링크{" "}
          <input
            readOnly
            value={share}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
      {showVideo && social?.videoId && (
        <iframe
          title="크리에이터 YouTube 동영상"
          src={`https://www.youtube-nocookie.com/embed/${social.videoId}`}
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin"
          style={{
            width: "100%",
            minHeight: 200,
            aspectRatio: "16 / 9",
            border: 0,
          }}
        />
      )}
    </div>
  );
}
