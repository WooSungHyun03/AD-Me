"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import { categories, vibes } from "@/lib/catalog";
type Profile = {
  social_url?: string;
  portfolio_url?: string;
  owner_consent?: boolean;
  name?: string;
  bio?: string;
  categories?: string[];
  vibes?: string[];
  formats?: string[];
  platforms?: string[];
  price_min_krw?: number;
  price_max_krw?: number;
  is_available?: boolean;
  published?: boolean;
};
export function ProfileForm({ initial = {} }: { initial?: Profile }) {
  const [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const f = new FormData(e.currentTarget);
        const body = {
          ...Object.fromEntries(f),
          categories: [f.get("category")],
          vibes: [f.get("vibe")],
          formats: [f.get("format")],
          platforms: [f.get("platform")],
          price_min_krw: Number(f.get("price_min_krw")),
          price_max_krw: Number(f.get("price_max_krw")),
          published: f.get("published") === "on",
          owner_consent: f.get("owner_consent") === "on",
          is_available: f.get("is_available") === "on",
        };
        try {
          const res = await fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const d = await res.json();
          setMessage(
            res.ok ? "프로필을 저장했습니다." : d.error?.message || "저장 실패",
          );
        } catch {
          setMessage("네트워크 연결을 확인해주세요.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="field">
        크리에이터 이름
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={initial.name}
        />
      </label>
      <label className="field">
        소개
        <textarea
          aria-label="소개"
          name="bio"
          maxLength={1000}
          defaultValue={initial.bio}
        />
      </label>
      <label className="field">
        대표 SNS 링크
        <input
          name="social_url"
          type="url"
          defaultValue={initial.social_url ?? ""}
          placeholder="https://"
          maxLength={1000}
        />
      </label>
      <label className="field">
        포트폴리오 링크
        <input
          name="portfolio_url"
          type="url"
          defaultValue={initial.portfolio_url ?? ""}
          placeholder="https://"
          maxLength={1000}
        />
      </label>
      <label className="inline">
        <input
          type="checkbox"
          name="owner_consent"
          defaultChecked={initial.owner_consent ?? false}
        />
        입력한 링크·콘텐츠의 권리가 있으며 공개에 동의합니다.
      </label>
      <div className="form-grid">
        <label className="field">
          분야
          <select
            aria-label="분야"
            name="category"
            defaultValue={initial.categories?.[0]}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          분위기
          <select
            aria-label="분위기"
            name="vibe"
            defaultValue={initial.vibes?.[0]}
          >
            {vibes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          광고 형식
          <select
            aria-label="광고 형식"
            name="format"
            defaultValue={initial.formats?.[0]}
          >
            {[
              "숏폼",
              "제품 리뷰",
              "브이로그",
              "언박싱",
              "튜토리얼",
              "PPL",
              "화보",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          플랫폼
          <select
            aria-label="플랫폼"
            name="platform"
            defaultValue={initial.platforms?.[0]}
          >
            {["instagram", "youtube", "tiktok"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          최소 견적
          <input
            type="number"
            name="price_min_krw"
            required
            min="0"
            max="100000000"
            defaultValue={initial.price_min_krw ?? 200000}
          />
        </label>
        <label className="field">
          최대 견적
          <input
            type="number"
            name="price_max_krw"
            required
            min="0"
            max="100000000"
            defaultValue={initial.price_max_krw ?? 500000}
          />
        </label>
      </div>
      <label className="inline">
        <input
          type="checkbox"
          name="is_available"
          defaultChecked={initial.is_available ?? true}
        />
        협업 가능
      </label>
      <label className="inline">
        <input
          type="checkbox"
          name="published"
          defaultChecked={initial.published ?? false}
        />
        프로필 공개
      </label>
      <div className="notice">
        본인 등록 정보로 표시됩니다. 외부 SNS 팔로워·참여율은 검증된 데이터 연결
        전까지 미확보로 처리합니다.
      </div>
      <Button disabled={pending}>{pending ? "저장 중…" : "프로필 저장"}</Button>
      <button
        type="button"
        className="button outline"
        onClick={async () => {
          if (
            !window.confirm(
              "공개 프로필 정보를 삭제하시겠습니까? 기존 협업 기록은 유지됩니다. 이후 다시 등록할 수 있습니다.",
            )
          )
            return;
          const res = await fetch("/api/profile", { method: "DELETE" });
          const d = await res.json();
          setMessage(
            res.ok ? "프로필을 삭제했습니다." : d.error?.message || "삭제 실패",
          );
        }}
      >
        프로필 삭제
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
