"use client";
import { useState } from "react";
import { Button } from "./ui/button";
export function AiStudio() {
  const [result, setResult] = useState("");
  return (
    <div className="split">
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const product = String(f.get("product")),
            audience = String(f.get("audience")),
            tone = String(f.get("tone")),
            name = String(f.get("name") || "크리에이터");
          const type = f.get("type");
          setResult(
            type === "concept"
              ? `[규칙 기반 광고 콘셉트 초안]\n\n콘셉트: 나의 일상에 ${product}를 더하다\n\n대상: ${audience}\n분위기: ${tone}\n\n1. 오프닝: 일상 속 불편하거나 아쉬운 순간을 짧게 보여줍니다.\n2. 전환: ${product}를 실제 사용하는 장면으로 자연스럽게 연결합니다.\n3. 핵심: 과장 없이 직접 확인한 특징 1~2가지를 전합니다.\n4. 마무리: 사용 맥락과 확인 가능한 제품 정보를 안내합니다.\n\n제작 전 확인: 광고·협찬 표기, 제품 효능 근거, 촬영·사용 권한, 게시 일정.\n이 초안은 제품의 효과나 성과를 보증하지 않습니다.`
              : `[규칙 기반 협업 제안 초안]\n\n안녕하세요, ${name}님.\n${product} 캠페인 협업을 제안드립니다.\n\n${audience}에게 ${tone} 분위기로 제품을 소개하고자 합니다. 크리에이터님의 콘텐츠 방향과 잘 맞는지 함께 논의하고 싶습니다.\n\n가능한 콘텐츠 형식, 일정, 견적과 광고 표기 조건을 알려주시면 구체적인 브리프를 공유하겠습니다.\n\n감사합니다.\n\n발송 전 실제 프로필과 브랜드의 조건에 맞게 수정해주세요.`,
          );
        }}
      >
        <label className="field">
          만들고 싶은 초안
          <select name="type">
            <option value="concept">광고 콘셉트</option>
            <option value="proposal">협업 제안 메시지</option>
          </select>
        </label>
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
        <label className="field">
          크리에이터 이름 (선택)
          <input name="name" maxLength={80} />
        </label>
        <Button>초안 만들기 ↗</Button>
      </form>
      <div className="panel">
        <span className="badge">API 키 없이 작동 · 규칙 기반</span>
        <h3 style={{ marginTop: 20 }}>생각을 시작하는 첫 문장.</h3>
        {result ? (
          <>
            <p style={{ whiteSpace: "pre-wrap" }} aria-live="polite">
              {result}
            </p>
            <Button
              variant="outline"
              onClick={() => navigator.clipboard.writeText(result)}
            >
              초안 복사
            </Button>
          </>
        ) : (
          <p>
            상품과 타깃을 입력하면 이곳에 초안이 표시됩니다. 외부 LLM에 정보를
            전송하지 않으며 성과 수치를 생성하지 않습니다.
          </p>
        )}
      </div>
    </div>
  );
}
