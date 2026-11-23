"use client";
import { creatorPlatforms } from "@/lib/service-catalog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  categories,
  vibes,
  matchingPolicySchema,
  type Policy,
} from "@/lib/catalog";
import { Button } from "./ui/button";
import { ZodError } from "zod";
import {
  campaignTermsFromForm,
  type CampaignTerms,
} from "@/lib/campaign-brief";
import { CampaignTermsFields } from "./campaign-terms-fields";
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
  terms?: CampaignTerms;
  policy?: Partial<Policy>;
};
export function CampaignForm({
  id,
  initial,
  creatorId,
}: {
  id?: string;
  initial?: CampaignInput;
  creatorId?: string;
}) {
  const [tags, setTags] = useState<string[]>(initial?.vibes ?? ["자연스러움"]),
    [platforms, setPlatforms] = useState(
      (id && initial?.platforms) || ["youtube"],
    ),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const router = useRouter();
  const [structured, setStructured] = useState(!id || Boolean(initial?.terms));
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const d = Object.fromEntries(form);
    try {
      const brief = {
        ...Object.fromEntries(
          [
            "title",
            "product",
            "category",
            "target_audience",
            "goal",
            "format",
            "status",
          ].map((key) => [key, d[key]]),
        ),
        vibes: tags,
        platforms,
        budget_krw: Number(d.budget_krw),
        policy: matchingPolicySchema.parse({
          category: d.policy_category,
          budget: d.policy_budget,
          unknown: d.policy_unknown,
        }),
        ...(structured ? { terms: campaignTermsFromForm(form) } : {}),
      };
      const res = await fetch("/api/campaigns", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id, brief } : brief),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "저장 실패");
      router.push(
        creatorId
          ? `/campaigns/${data.id}?creator=${encodeURIComponent(creatorId)}#proposal`
          : `/campaigns/${data.id}`,
      );
    } catch (e) {
      setError(
        e instanceof ZodError
          ? "일정 순서·제공 조건·산출물 항목을 확인해주세요."
          : e instanceof Error
            ? e.message
            : "네트워크 오류입니다.",
      );
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
      <fieldset style={{ marginTop: 24 }}>
        <legend>추천 조건</legend>
        <p>
          필수 조건이 맞지 않는 후보는 제외합니다. 정보가 없는 후보는 아래
          기준으로 처리합니다.
        </p>
        <div className="form-grid">
          <label className="field">
            분야 조건
            <select
              name="policy_category"
              defaultValue={initial?.policy?.category ?? "soft"}
            >
              <option value="soft">선호 조건으로 점수 반영</option>
              <option value="hard">필수 일치</option>
            </select>
          </label>
          <label className="field">
            예산 조건
            <select
              name="policy_budget"
              defaultValue={initial?.policy?.budget ?? "soft"}
            >
              <option value="soft">선호 조건으로 점수 반영</option>
              <option value="hard">최소 견적이 예산 이내</option>
            </select>
          </label>
          <label className="field">
            필수 정보 미확인 후보
            <select
              name="policy_unknown"
              defaultValue={initial?.policy?.unknown ?? "hold"}
            >
              <option value="hold">확인 전 보류로 구분</option>
              <option value="exclude">추천에서 제외</option>
            </select>
          </label>
        </div>
      </fieldset>
      {id && !initial?.terms && (
        <div className="notice" style={{ marginTop: 24 }}>
          <p>
            이전 버전 캠페인입니다. 기존 정보를 유지하면서 상세 협업 조건을
            추가할 수 있습니다.
          </p>
          <label>
            <input
              type="checkbox"
              checked={structured}
              onChange={(e) => setStructured(e.target.checked)}
            />{" "}
            일정·제공 조건·산출물 추가
          </label>
        </div>
      )}
      {structured && <CampaignTermsFields initial={initial?.terms} />}
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
        {creatorPlatforms
          .filter(
            (platform) =>
              platform === "youtube" ||
              (id && initial?.platforms.includes(platform)),
          )
          .map((p) => (
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
