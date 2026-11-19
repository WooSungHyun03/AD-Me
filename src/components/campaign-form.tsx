"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { categories, vibes } from "@/lib/catalog";
import { Button } from "./ui/button";
type CampaignInput = {
  title: string;
  product: string;
  category: string;
  vibes: string[];
  platforms: string[];
  budget_krw: number;
  target_audience: string;
  goal: string;
  format: string;
  status: string;
};
export function CampaignForm({
  id,
  initial,
}: {
  id?: string;
  initial?: CampaignInput;
}) {
  const [tags, setTags] = useState<string[]>(initial?.vibes ?? ["자연스러움"]),
    [platforms, setPlatforms] = useState(initial?.platforms ?? ["instagram"]),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/campaigns", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          id
            ? {
                id,
                brief: {
                  ...d,
                  vibes: tags,
                  platforms,
                  budget_krw: Number(d.budget_krw),
                },
              }
            : {
                ...d,
                vibes: tags,
                platforms,
                budget_krw: Number(d.budget_krw),
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "저장 실패");
      router.push(`/campaigns/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류입니다.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="panel">
      <div className="form-grid">
        <label className="field">
          캠페인 이름
          <input
            name="title"
            defaultValue={initial?.title}
            required
            minLength={2}
            maxLength={120}
            placeholder="예: 비건 토너 출시 캠페인"
          />
        </label>
        <label className="field">
          상품·서비스
          <input
            name="product"
            defaultValue={initial?.product}
            required
            maxLength={120}
            placeholder="함께 알리고 싶은 상품"
          />
        </label>
        <label className="field">
          콘텐츠 분야
          <select
            name="category"
            defaultValue={initial?.category}
            aria-label="콘텐츠 분야"
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          총 예산 (원)
          <input
            name="budget_krw"
            type="number"
            required
            min="10000"
            max="100000000"
            defaultValue={initial?.budget_krw ?? 1000000}
          />
        </label>
        <label className="field">
          타깃 고객
          <input
            name="target_audience"
            defaultValue={initial?.target_audience}
            required
            minLength={2}
            maxLength={500}
            placeholder="예: 건강한 일상을 즐기는 20~30대"
          />
        </label>
        <label className="field">
          광고 목적
          <input
            name="goal"
            defaultValue={initial?.goal}
            required
            minLength={2}
            maxLength={500}
            placeholder="예: 신제품 인지도 높이기"
          />
        </label>
        <label className="field">
          콘텐츠 형식
          <select
            name="format"
            defaultValue={initial?.format}
            aria-label="콘텐츠 형식"
          >
            {[
              "숏폼",
              "제품 리뷰",
              "브이로그",
              "언박싱",
              "튜토리얼",
              "PPL",
              "화보",
              "라이브 방송",
            ].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="field">
          공개 상태
          <select
            name="status"
            defaultValue={initial?.status}
            aria-label="공개 상태"
          >
            <option value="draft">초안 (나만 보기)</option>
            <option value="published">공개 모집</option>
            <option value="closed">모집 마감</option>
          </select>
        </label>
      </div>
      <h3 style={{ marginTop: 30, fontSize: 15 }}>
        선호하는 이미지·분위기 (최대 8개)
      </h3>
      <div className="tags">
        {vibes.map((t) => (
          <button
            type="button"
            key={t}
            aria-pressed={tags.includes(t)}
            className={`button small ${tags.includes(t) ? "primary" : "outline"}`}
            onClick={() =>
              setTags((s) =>
                s.includes(t)
                  ? s.filter((x) => x !== t)
                  : s.length < 8
                    ? [...s, t]
                    : s,
              )
            }
          >
            {t}
          </button>
        ))}
      </div>
      <h3 style={{ marginTop: 30, fontSize: 15 }}>광고 플랫폼</h3>
      <div className="inline">
        {["instagram", "youtube", "tiktok"].map((p) => (
          <label key={p} className="inline">
            <input
              type="checkbox"
              checked={platforms.includes(p)}
              onChange={() =>
                setPlatforms((s) =>
                  s.includes(p) ? s.filter((x) => x !== p) : [...s, p],
                )
              }
            />
            {p}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="error" style={{ marginTop: 22 }}>
          {error}
        </p>
      )}
      <Button
        style={{ marginTop: 30 }}
        disabled={pending || !tags.length || !platforms.length}
      >
        {pending ? "저장 중…" : "캠페인 저장 →"}
      </Button>
    </form>
  );
}
