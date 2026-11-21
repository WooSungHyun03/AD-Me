"use client";
import { useRef, useState } from "react";
import {
  adFilterSchema,
  adPageSchema,
  competitorSchema,
} from "@/lib/ad-timeline";
import type { z } from "zod";
import { adInterestLabels, adDisclosureLabels } from "@/lib/reviews";
export function AdTimeline({
  creatorId,
  initial,
  canEdit,
  initialLabels,
}: {
  creatorId: string;
  initial: z.infer<typeof adPageSchema>;
  canEdit: boolean;
  initialLabels: string[];
}) {
  const [page, setPage] = useState(initial),
    [filters, setFilters] = useState({
      brand: "",
      category: "",
      from: "",
      to: "",
    }),
    [applied, setApplied] = useState(filters),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [labels, setLabels] = useState(initialLabels.join("\n")),
    [saved, setSaved] = useState("");
  const generation = useRef(0);
  async function load(more = false) {
    const current = more ? applied : filters,
      parsed = adFilterSchema.safeParse({ creatorId, ...current });
    if (!parsed.success) {
      setError("기간과 검색 조건을 확인해주세요.");
      return;
    }
    const gen = ++generation.current;
    setPending(true);
    setError("");
    try {
      const q = new URLSearchParams(parsed.data);
      if (more && page.nextCursor)
        q.set("cursor", JSON.stringify(page.nextCursor));
      const res = await fetch(`/api/ad-history/search?${q}`, {
        cache: "no-store",
      });
      if (!res.ok) throw Error();
      const next = adPageSchema.parse(await res.json());
      if (gen !== generation.current) return;
      setPage({
        ...next,
        items: more ? [...page.items, ...next.items] : next.items,
      });
      setApplied(current);
    } catch {
      if (gen === generation.current)
        setError("광고 이력을 불러오지 못했습니다. 다시 검색해주세요.");
    } finally {
      if (gen === generation.current) setPending(false);
    }
  }
  return (
    <div aria-busy={pending}>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label className="field">
          광고 브랜드
          <input
            value={filters.brand}
            maxLength={100}
            onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
          />
        </label>
        <label className="field">
          광고 카테고리
          <input
            value={filters.category}
            maxLength={50}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value })
            }
            placeholder="전체 · 정확한 분야명"
          />
        </label>
        <div className="form-grid">
          {(
            [
              ["from", "광고 기간 시작"],
              ["to", "광고 기간 종료"],
            ] as const
          ).map(([key, title]) => (
            <label className="field" key={key}>
              {title}
              <input
                type="date"
                value={filters[key]}
                onChange={(e) =>
                  setFilters({ ...filters, [key]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        <button className="button outline small" disabled={pending}>
          광고 이력 검색
        </button>
      </form>
      {canEdit && (
        <details className="panel">
          <summary>내 브랜드 경쟁사 목록</summary>
          <p>
            이 계정에서만 사용하는 이름 목록입니다. 공개 평판이나 팀 공유 자료로
            사용하지 않습니다. 브랜드 이름과 대소문자 없이 정확히 일치하면
            표시합니다.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaved("");
              const parsed = competitorSchema.safeParse(
                labels
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              );
              if (!parsed.success) {
                setSaved("이름은 2~100자, 최대 20개까지 입력해주세요.");
                return;
              }
              try {
                const res = await fetch("/api/ad-history/competitors", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(parsed.data),
                });
                if (!res.ok) throw Error();
                setLabels(competitorSchema.parse(await res.json()).join("\n"));
                setSaved("개인 경쟁사 목록을 저장했습니다.");
                await load();
              } catch {
                setSaved("목록을 저장하지 못했습니다. 다시 시도해주세요.");
              }
            }}
          >
            <label className="field">
              경쟁사 이름 · 한 줄에 하나
              <textarea
                value={labels}
                maxLength={2020}
                onChange={(e) => setLabels(e.target.value)}
              />
            </label>
            <button className="button outline small" disabled={pending}>
              경쟁사 목록 저장
            </button>
            <p role="status">{saved}</p>
          </form>
        </details>
      )}
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      <p role="status">검색 조건에 맞는 공개 검토 광고 {page.total}건</p>
      {!page.items.length && (
        <p>
          공개된 제출 광고 이력이 없습니다. 자료 미확보는 광고 경험이 없다는
          뜻이 아닙니다.
        </p>
      )}
      {page.items.map(({ record: r, competitor }) => (
        <article
          className="notice ad-timeline-record"
          key={r.id}
          data-testid="public-ad-history"
          style={{ overflowWrap: "anywhere" }}
        >
          <strong>{r.payload.brandLabel}</strong>
          {r.isDemo && <span className="badge">DEMO</span>}
          {competitor && <span className="badge">내 경쟁사 목록과 일치</span>}
          <p>
            {r.payload.startedOn} ~ {r.payload.endedOn} · {r.payload.category} ·{" "}
            {r.payload.format}
          </p>
          <p>
            {adInterestLabels[r.payload.interest]} ·{" "}
            {adDisclosureLabels[r.payload.disclosure]}
          </p>
          <p>{r.summary}</p>
          <a
            href={r.payload.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            광고 근거 출처 ↗
          </a>
          <p>
            본인 제출 자료의 운영 검토 · 버전 {r.version} ·{" "}
            {new Date(r.reviewedAt).toLocaleDateString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}{" "}
            · 정책 {r.policyVersion}
          </p>
          <p className="muted">
            플랫폼 소유권 인증이나 법적 표시 준수 보증이 아닙니다.
          </p>
        </article>
      ))}
      {page.nextCursor && (
        <button
          className="button outline small"
          disabled={pending}
          onClick={() => void load(true)}
        >
          다음 광고 이력
        </button>
      )}
    </div>
  );
}
