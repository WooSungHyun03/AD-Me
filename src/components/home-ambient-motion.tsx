"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export function HomeAmbientMotion() {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(false);

  useEffect(() => {
    function syncVisibility() {
      setForeground(!document.hidden);
    }
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
    });
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  return (
    <div
      ref={root}
      className="hero-ambient"
      data-running={visible && foreground && !paused}
    >
      <span className="hero-ambient-shape" aria-hidden="true" />
      <button
        type="button"
        className="hero-motion-toggle"
        aria-label={paused ? "배경 모션 재생" : "배경 모션 일시정지"}
        onClick={() => setPaused(!paused)}
      >
        {paused ? (
          <Play size={16} aria-hidden="true" />
        ) : (
          <Pause size={16} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
