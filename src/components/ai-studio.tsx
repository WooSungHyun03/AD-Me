"use client";
import { useState } from "react";
import { Button } from "./ui/button";
type Draft = {
  text: string;
  method: "template" | "llm";
  version: string;
  provider: string | null;
  model: string | null;
  fallback_reason: string | null;
  sources: string[];
  unverified: string[];
};
// D048: drafts come from the server adapter. Nothing is ever sent automatically: the user edits the draft,
// confirms the review, and only then can copy it into a proposal.
export function AiStudio() {
  const [kind, setKind] = useState("concept");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  const [approved, setApproved] = useState(false);
  const [message, setMessage] = useState("");
  const fieldsFor = (k: string) =>
    k === "summary"
      ? ["text"]
      : [
          "product",
          "audience",
          "tone",
          k === "proposal" ? "name" : k === "brief" ? "goal" : "",
        ].filter(Boolean);
  return (
    <div className="split">
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const input = Object.fromEntries(
            fieldsFor(kind).map((k) => [k, String(f.get(k) ?? "")]),
          );
          setMessage("초안을 만드는 중입니다.");
          try {
            const res = await fetch("/api/ai/draft", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind, input }),
            });
            const d = await res.json();
            if (!res.ok)
              return setMessage(
                d.error?.message ?? "초안을 만들지 못했습니다.",
              );
            setDraft(d);
            setText(d.text);
            setApproved(false);
            setMessage("");
          } catch {
            setMessage("네트워크 오류입니다.");
          }
        }}
      >
        <label className="field">
          만들고 싶은 초안
          <select
            name="type"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="concept">광고 콘셉트</option>
            <option value="proposal">협업 제안 메시지</option>
            <option value="brief">캠페인 브리프</option>
            <option value="summary">원문 요약</option>
          </select>
        </label>
        {kind === "summary" ? (
          <label className="field">
            요약할 원문
            <textarea name="text" required maxLength={3000} rows={8} />
          </label>
        ) : (
          <>
            <label className="field">
              상품·서비스
              <input
                name="product"
                required
                maxLength={100}
                placeholder="예: 비건 토너"
              />
            </label>
            <label className="field">
              타깃 고객
              <input name="audience" required maxLength={200} />
            </label>
            <label className="field">
              원하는 분위기
              <input
                name="tone"
                required
                maxLength={100}
                placeholder="예: 자연스럽고 미니멀한"
              />
            </label>
            {kind === "proposal" && (
              <label className="field">
                크리에이터 이름 (선택)
                <input name="name" maxLength={80} />
              </label>
            )}
            {kind === "brief" && (
              <label className="field">
                캠페인 목표 (선택)
                <input name="goal" maxLength={300} />
              </label>
            )}
          </>
        )}
        <Button>초안 만들기 ↗</Button>
        <span role="status">{message}</span>
      </form>
      <div className="panel">
        {draft ? (
          <>
            <span className="badge" data-testid="ai-method">
              {draft.method === "llm"
                ? `LLM 생성 · ${draft.provider} ${draft.model} · ${draft.version}`
                : `규칙 템플릿 · ${draft.version}`}
            </span>
            {draft.fallback_reason && (
              <p style={{ fontSize: 13 }}>
                템플릿 사용 사유: {draft.fallback_reason}
              </p>
            )}
            <label className="field" style={{ marginTop: 16 }}>
              초안 (직접 수정 가능)
              <textarea
                value={text}
                rows={14}
                onChange={(e) => {
                  setText(e.target.value);
                  setApproved(false);
                }}
              />
            </label>
            <p style={{ fontSize: 13 }}>
              사실 출처: 입력한 {draft.sources.join(", ")}만 사용합니다.
              수치·효능·성과는 생성하지 않습니다.
            </p>
            {draft.unverified.length > 0 && (
              <p className="notice" style={{ fontSize: 13 }}>
                입력에 없던 수치가 있습니다. 확인 후 지우거나 근거를 확인하세요:{" "}
                {draft.unverified.join(", ")}
              </p>
            )}
            <label
              className="inline"
              style={{ flexWrap: "nowrap", fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />
              내용을 검토했고 사실과 다른 부분을 고쳤습니다.
            </label>
            <Button
              variant="outline"
              disabled={!approved}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  setMessage("복사했습니다. 제안서에 붙여넣어 직접 보내세요.");
                } catch {
                  setMessage("복사하지 못했습니다. 직접 선택해 복사하세요.");
                }
              }}
            >
              검토한 초안 복사
            </Button>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              초안은 자동으로 전송되지 않습니다.
            </p>
          </>
        ) : (
          <>
            <span className="badge">생성 방식 표시 · 자동 전송 없음</span>
            <h3 style={{ marginTop: 20 }}>생각을 시작하는 첫 문장.</h3>
            <p>
              입력하면 이곳에 초안이 표시됩니다. LLM이 연결되지 않았거나
              실패하면 규칙 템플릿으로 만들고 그 사실을 표시합니다. 성과 수치는
              생성하지 않습니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
