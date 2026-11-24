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
      <div className="hero-ambient-shape">
        <p className="figma-eyebrow">AI MATCH INSIGHT</p>
        <strong>상품과 조건에 맞는 후보 찾기</strong>
        <p>콘텐츠 분야 · 타깃 · 광고 예산</p>
      </div>
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
