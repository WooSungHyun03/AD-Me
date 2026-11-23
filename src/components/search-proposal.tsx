"use client";
import { useState } from "react";
import { proposeSearch, type SearchProposal } from "@/lib/search-parser";
import type { CreatorFilters } from "@/lib/creator-filters";
export function SearchProposalForm({
  apply,
}: {
  apply: (filters: CreatorFilters) => void;
}) {
  const [text, setText] = useState(""),
    [proposal, setProposal] = useState<SearchProposal | null>(null),
    [error, setError] = useState("");
  return (
    <details className="panel">
      <summary>문장으로 검색 조건 제안받기</summary>
      <p>
        예: 인스타그램 뷰티 팔로워 1만명 이상 예산 100만원 이하. 지원하는 표현만
        해석하며 적용 전 확인합니다.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          try {
            setProposal(proposeSearch(text));
          } catch (e) {
            setProposal(null);
            setError(e instanceof Error ? e.message : "조건을 확인해주세요.");
          }
        }}
      >
        <label className="field">
          검색 문장
          <input
            value={text}
            maxLength={500}
            onChange={(e) => {
              setText(e.target.value);
              setProposal(null);
            }}
          />
        </label>
        <button className="button outline small" type="submit">
          조건 제안 확인
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {proposal && (
        <div role="region" aria-label="검색 조건 제안">
          <p>제안: {proposal.evidence.join(" · ") || "인식한 조건 없음"}</p>
          {proposal.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          {proposal.unparsed && <p>적용하지 않는 문구: {proposal.unparsed}</p>}
          <p>
            확인하면 기존 필터 전체를 대체합니다. 적용 후 아래 필터에서 수정할
            수 있습니다.
          </p>
          <button
            className="button small"
            type="button"
            disabled={!proposal.evidence.length}
            onClick={() => {
              apply(proposal.filters);
              setProposal(null);
            }}
          >
            확인한 조건 적용
          </button>
          <button
            className="button outline small"
            type="button"
            onClick={() => setProposal(null)}
          >
            제안 취소
          </button>
        </div>
      )}
    </details>
  );
}
