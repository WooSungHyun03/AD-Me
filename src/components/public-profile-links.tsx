"use client";

import { useEffect, useRef, useState } from "react";
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
  const [attempt, setAttempt] = useState(0),
    [videoError, setVideoError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!showVideo) return;
    timer.current = setTimeout(() => setVideoError(true), 8000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [showVideo, attempt]);
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
            onClick={() => {
              setVideoError(false);
              setShowVideo(!showVideo);
            }}
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
        <>
          <p role="status">
            {videoError
              ? "플레이어 연결을 확인하지 못했습니다. 원본에서 확인하거나 다시 연결해주세요."
              : "공식 플레이어 연결을 요청했습니다. 재생 제한·네트워크 오류가 있으면 원본에서 확인해주세요."}{" "}
            <a href={social.href} target="_blank" rel="noopener noreferrer">
              YouTube 원본에서 보기 ↗
            </a>
          </p>
          <button
            type="button"
            className="button outline small"
            onClick={() => {
              setVideoError(false);
              setAttempt((n) => n + 1);
            }}
          >
            플레이어 다시 연결
          </button>
          <iframe
            key={attempt}
            title="크리에이터 YouTube 동영상"
            src={`https://www.youtube-nocookie.com/embed/${social.videoId}`}
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="strict-origin"
            onError={() => setVideoError(true)}
            onLoad={() => {
              if (timer.current) clearTimeout(timer.current);
            }}
            style={{
              width: "100%",
              minHeight: 200,
              aspectRatio: "16 / 9",
              border: 0,
            }}
          />
        </>
      )}
    </div>
  );
}
