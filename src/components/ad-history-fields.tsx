"use client";
import {
  adDisclosureLabels,
  adEvidenceKinds,
  adInterestLabels,
} from "@/lib/reviews";
import type { z } from "zod";
import type { adPayloadSchema } from "@/lib/reviews";
export function adPayloadFromForm(f: FormData) {
  return Object.fromEntries(
    [
      "brandLabel",
      "category",
      "format",
      "startedOn",
      "endedOn",
      "interest",
      "disclosure",
      "evidenceKind",
      "sourceUrl",
    ].map((k) => [k, f.get(k)]),
  ) as Record<string, unknown>;
}
export function AdHistoryFields({
  initial,
}: {
  initial?: z.infer<typeof adPayloadSchema>;
}) {
  return (
    <>
      <label className="field">
        광고 브랜드명
        <input
          name="brandLabel"
          required
          minLength={2}
          maxLength={100}
          defaultValue={initial?.brandLabel}
        />
      </label>
      <label className="field">
        광고 분야
        <input
          name="category"
          required
          minLength={2}
          maxLength={50}
          defaultValue={initial?.category}
        />
      </label>
      <label className="field">
        광고 형식
        <input
          name="format"
          required
          minLength={2}
          maxLength={50}
          defaultValue={initial?.format}
          placeholder="예: 숏폼 영상"
        />
      </label>
      <div className="form-grid">
        <label className="field">
          광고 시작일
          <input
            name="startedOn"
            type="date"
            required
            defaultValue={initial?.startedOn}
          />
        </label>
        <label className="field">
          광고 종료일
          <input
            name="endedOn"
            type="date"
            required
            defaultValue={initial?.endedOn}
          />
        </label>
      </div>
      <label className="field">
        경제적 이해관계
        <select name="interest" defaultValue={initial?.interest ?? "unknown"}>
          {Object.entries(adInterestLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        이해관계 표시 확인
        <select
          name="disclosure"
          defaultValue={initial?.disclosure ?? "unclear"}
        >
          {Object.entries(adDisclosureLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        광고 근거 종류
        <select
          name="evidenceKind"
          defaultValue={initial?.evidenceKind ?? "self_declaration"}
        >
          {adEvidenceKinds.map((v) => (
            <option key={v} value={v}>
              {
                {
                  self_declaration: "본인 진술",
                  paid_partnership_label: "유료 파트너십 표시",
                  official_confirmation: "공식 확인 자료",
                  brand_mention: "단순 브랜드 언급",
                }[v]
              }
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        광고 근거 URL
        <input
          name="sourceUrl"
          type="url"
          required
          maxLength={1000}
          placeholder="https://"
          defaultValue={initial?.sourceUrl}
        />
      </label>
      <label>
        <input
          type="checkbox"
          name="ownershipConfirmed"
          required
          defaultChecked={false}
        />{" "}
        이 자료를 제출할 권한이 있으며, 확인한 내용을 사실대로 작성했습니다.
      </label>
    </>
  );
}
