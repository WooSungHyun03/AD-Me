"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { categories, vibes, formats, platforms } from "@/lib/catalog";
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
  price_min_krw?: number | null;
  price_max_krw?: number | null;
  is_available?: boolean | null;
  published?: boolean;
};
export function ProfileForm({ initial = {} }: { initial?: Profile }) {
  const router = useRouter();
  const [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    [priceUnknown, setPriceUnknown] = useState(initial.price_min_krw === null);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const f = new FormData(e.currentTarget);
        const body = {
          ...Object.fromEntries(f),
          categories: f.getAll("categories"),
          vibes: f.getAll("vibes"),
          formats: f.getAll("formats"),
          platforms: f.getAll("platforms"),
          price_min_krw: priceUnknown ? null : Number(f.get("price_min_krw")),
          price_max_krw: priceUnknown ? null : Number(f.get("price_max_krw")),
          published: f.get("published") === "on",
          owner_consent: f.get("owner_consent") === "on",
          is_available:
            f.get("availability") === "unknown"
              ? null
              : f.get("availability") === "yes",
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
      {(
        [
          ["categories", "분야 (최대 5)", categories, 5],
          ["vibes", "분위기 (최대 8)", vibes, 8],
          ["formats", "광고 형식", formats, 8],
          ["platforms", "플랫폼", platforms, 3],
        ] as const
      ).map(([name, legend, options]) => (
        <fieldset key={name} className="field">
          <legend>{legend}</legend>
          <div className="tags">
            {options.map((o, i) => (
              <label key={o} className="inline">
                <input
                  type="checkbox"
                  name={name}
                  value={o}
                  defaultChecked={
                    // deleted profiles keep empty arrays; fall back to a default pick
                    initial[name]?.length ? initial[name]!.includes(o) : i === 0
                  }
                />
                {o}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <label className="inline">
        <input
          type="checkbox"
          checked={priceUnknown}
          onChange={(e) => setPriceUnknown(e.target.checked)}
        />
        견적 미확인 (협의 후 결정)
      </label>
      {!priceUnknown && (
        <div className="form-grid">
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
      )}
      <label className="field">
        협업 의사
        <select
          name="availability"
          defaultValue={
            initial.is_available === null
              ? "unknown"
              : initial.is_available === false
                ? "no"
                : "yes"
          }
        >
          <option value="yes">협업 가능</option>
          <option value="no">현재 일정 어려움</option>
          <option value="unknown">미정</option>
        </select>
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
          if (res.status === 401) {
            router.push("/login?next=/settings&reauth=1");
            return;
          }
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
