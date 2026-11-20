"use client";
import { useRef, useState } from "react";
import { type CampaignTerms, utcToKstInput } from "@/lib/campaign-brief";

export function CampaignTermsFields({ initial }: { initial?: CampaignTerms }) {
  const c = initial?.compensation;
  const [mode, setMode] = useState(
    !c || c.mode === "unknown"
      ? "unknown"
      : c.cash && c.product
        ? "mixed"
        : c.cash
          ? "cash"
          : "product",
  );
  const [rows, setRows] = useState(
    (
      initial?.deliverables ?? [
        { format: "숏폼", quantity: 1, usageRights: "", exclusivity: null },
      ]
    ).map((value, key) => ({ key, value })),
  );
  const nextKey = useRef(rows.length);
  return (
    <section aria-label="상세 협업 조건">
      <h2>일정·제공 조건·산출물</h2>
      <p>
        시각은 대한민국 표준시(KST)로 입력합니다. 기간과 공개 모집 상태는 별도로
        관리합니다.
      </p>
      {(
        [
          ["recruitment", "모집"],
          ["production", "제작"],
          ["posting", "게시"],
        ] as const
      ).map(([key, label]) => (
        <fieldset key={key} className="terms-fieldset">
          <legend>{label} 기간</legend>
          <div className="form-grid">
            {(
              [
                ["start", "시작"],
                ["end", "종료"],
              ] as const
            ).map(([point, text]) => (
              <label key={point} className="field">
                {label} {text} (KST)
                <input
                  type="datetime-local"
                  name={`${key}_${point}`}
                  required
                  defaultValue={
                    initial ? utcToKstInput(initial[key][point]) : ""
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <fieldset className="terms-fieldset">
        <legend>제공 조건</legend>
        <label className="field">
          제공 유형
          <select
            name="compensation_mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="unknown">미정</option>
            <option value="cash">현금</option>
            <option value="product">제품 제공</option>
            <option value="mixed">현금 + 제품 제공</option>
          </select>
        </label>
        {mode === "unknown" && (
          <p>보상 조건이 미정으로 표시됩니다. 금액 0원과 구분해 기록합니다.</p>
        )}
        {["cash", "mixed"].includes(mode) && (
          <div className="form-grid">
            <label className="field">
              최소 현금 단가 (원)
              <input
                name="cash_min"
                type="number"
                min="0"
                max="100000000"
                step="1"
                required
                defaultValue={
                  c?.mode === "declared" ? c.cash?.minimumKrw : undefined
                }
              />
            </label>
            <label className="field">
              최대 현금 단가 (원)
              <input
                name="cash_max"
                type="number"
                min="0"
                max="100000000"
                step="1"
                required
                defaultValue={
                  c?.mode === "declared" ? c.cash?.maximumKrw : undefined
                }
              />
            </label>
          </div>
        )}
        {["product", "mixed"].includes(mode) && (
          <div className="form-grid">
            <label className="field">
              제공 제품
              <input
                name="product_description"
                maxLength={300}
                required
                defaultValue={
                  c?.mode === "declared" ? c.product?.description : undefined
                }
              />
            </label>
            <label className="field">
              제공 제품 수량
              <input
                name="product_quantity"
                type="number"
                min="1"
                max="1000"
                step="1"
                required
                defaultValue={c?.mode === "declared" ? c.product?.quantity : 1}
              />
            </label>
          </div>
        )}
      </fieldset>
      <h3>산출물 (최대 20종)</h3>
      {rows.map(({ key, value }, i) => (
        <fieldset key={key} className="terms-fieldset">
          <legend>산출물 {i + 1}</legend>
          <div className="form-grid">
            <label className="field">
              산출물 {i + 1} 형식
              <input
                name="deliverable_format"
                required
                maxLength={80}
                defaultValue={value.format}
              />
            </label>
            <label className="field">
              산출물 {i + 1} 수량
              <input
                name="deliverable_quantity"
                type="number"
                min="1"
                max="100"
                step="1"
                required
                defaultValue={value.quantity}
              />
            </label>
            <label className="field">
              산출물 {i + 1} 사용권
              <textarea
                name="deliverable_rights"
                required
                maxLength={500}
                defaultValue={value.usageRights}
                placeholder="사용 채널·기간·2차 활용 범위"
              />
            </label>
            <label className="field">
              산출물 {i + 1} 독점 조건 (선택)
              <textarea
                name="deliverable_exclusivity"
                maxLength={500}
                defaultValue={value.exclusivity ?? ""}
                placeholder="없으면 비워두세요"
              />
            </label>
          </div>
          {rows.length > 1 && (
            <button
              type="button"
              className="button outline small"
              onClick={() =>
                setRows((current) => current.filter((row) => row.key !== key))
              }
            >
              산출물 {i + 1} 삭제
            </button>
          )}
        </fieldset>
      ))}
      <button
        type="button"
        className="button outline small"
        disabled={rows.length >= 20}
        onClick={() => {
          const key = nextKey.current++;
          setRows((current) => [
            ...current,
            {
              key,
              value: {
                format: "숏폼",
                quantity: 1,
                usageRights: "",
                exclusivity: null,
              },
            },
          ]);
        }}
      >
        산출물 추가
      </button>
    </section>
  );
}
