"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdHistoryFields, adPayloadFromForm } from "./ad-history-fields";
import { evidenceKinds, type ReviewCase } from "@/lib/reviews";
export function ReviewCaseActions({ item }: { item: ReviewCase }) {
  const [result, setResult] = useState(""),
    [pending, setPending] = useState(false);
  const sending = useRef(false),
    router = useRouter();
  async function run(path: string, data: object, form?: HTMLFormElement) {
    if (sending.current) return;
    sending.current = true;
    setPending(true);
    setResult("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          expectedVersion: item.version,
          ...data,
        }),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(
          body.error?.message ||
            "처리하지 못했습니다. 새로고침 후 다시 시도해주세요.",
        );
      form?.reset();
      setResult("저장되었습니다.");
      router.refresh();
    } catch (e) {
      setResult(
        e instanceof Error
          ? e.message
          : "네트워크 오류입니다. 최신 내용을 확인해주세요.",
      );
    } finally {
      sending.current = false;
      setPending(false);
    }
  }
  return (
    <div className="form-stack">
      {item.canRevise && (
        <>
          <details>
            <summary>제출 내용 정정</summary>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                void run("/api/reviews", {
                  action: "revise",
                  payload:
                    item.kind === "ad"
                      ? {
                          ...adPayloadFromForm(d),
                          ownershipConfirmed:
                            d.get("ownershipConfirmed") === "on",
                        }
                      : {
                          reason: d.get("reason"),
                          sourceUrl: d.get("sourceUrl"),
                          evidenceKind: d.get("evidenceKind"),
                        },
                });
              }}
            >
              {"reason" in item.payload ? (
                <>
                  <label className="field">
                    정정 내용
                    <textarea
                      name="reason"
                      defaultValue={item.payload.reason}
                      required
                      minLength={10}
                      maxLength={2000}
                    />
                  </label>
                  <label className="field">
                    정정 출처 URL
                    <input
                      name="sourceUrl"
                      defaultValue={item.payload.sourceUrl}
                      type="url"
                      required
                      maxLength={1000}
                    />
                  </label>
                  <label className="field">
                    근거 종류
                    <select
                      name="evidenceKind"
                      defaultValue={item.payload.evidenceKind}
                    >
                      {evidenceKinds.map((v) => (
                        <option key={v} value={v}>
                          {
                            {
                              claim: "미확인 주장",
                              source: "출처 자료",
                              official_statement: "공식 입장",
                              correction: "공식 정정",
                            }[v]
                          }
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <AdHistoryFields initial={item.payload} />
              )}
              <button className="button outline small" disabled={pending}>
                새 버전 제출
              </button>
            </form>
          </details>
          {item.status !== "withdrawn" && (
            <button
              className="button ghost small"
              disabled={pending}
              onClick={() => void run("/api/reviews", { action: "withdraw" })}
            >
              검토 요청 철회
            </button>
          )}
        </>
      )}
      {item.canRespond && item.status !== "withdrawn" && (
        <details>
          <summary>당사자 입장 제출</summary>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              void run(
                "/api/reviews",
                {
                  action: "respond",
                  body: d.get("body"),
                  sourceUrl: d.get("sourceUrl") || null,
                  publishConsent: d.get("publishConsent") === "on",
                },
                e.currentTarget,
              );
            }}
          >
            <p>
              답변은 새 버전을 만들고 다시 검토합니다. 검토 전에는 공개하지
              않습니다.
            </p>
            <label className="field">
              당사자 답변
              <textarea name="body" required minLength={10} maxLength={2000} />
            </label>
            <label className="field">
              답변 출처 URL
              <input name="sourceUrl" type="url" maxLength={1000} />
            </label>
            <label>
              <input name="publishConsent" type="checkbox" /> 검토 승인 시 이
              답변의 공개에 동의합니다.
            </label>
            <button className="button outline small" disabled={pending}>
              입장 제출
            </button>
          </form>
        </details>
      )}
      {item.canReview && item.status === "pending" && (
        <details>
          <summary>근거 검토·공개 판정</summary>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              void run("/api/admin/reviews", {
                verdict: d.get("verdict"),
                classification: d.get("classification"),
                note: d.get("note"),
                summary: d.get("summary") || "",
                publish: d.get("publish") === "on",
              });
            }}
          >
            <label className="field">
              검토 판정
              <select name="verdict">
                <option value="approved">자료 검토 승인</option>
                <option value="rejected">반려</option>
              </select>
            </label>
            <label className="field">
              사실 구분
              <select name="classification">
                <option value="unverified_claim">
                  미확인 주장 — 공개 불가
                </option>
                {item.kind === "ad" ? (
                  <option value="ad_evidence">확인 가능한 광고 근거</option>
                ) : (
                  <>
                    <option value="confirmed_fact">출처에서 확인한 사실</option>
                    <option value="official_correction">공식 정정</option>
                  </>
                )}
              </select>
            </label>
            <label className="field">
              비공개 검토 근거
              <textarea name="note" required minLength={10} maxLength={2000} />
            </label>
            <label className="field">
              공개할 검토 요약
              <textarea name="summary" maxLength={1000} />
            </label>
            <label>
              <input name="publish" type="checkbox" /> 승인된 공개 정책에 따라
              현재 버전을 공개합니다.
            </label>
            <p>
              미확인 주장·원본 신고 본문·내부 메모는 공개하지 않습니다. 정책
              승인 전에는 공개할 수 없습니다.
            </p>
            <button className="button primary small" disabled={pending}>
              검토 판정 저장
            </button>
          </form>
        </details>
      )}
      <p role="status">{result}</p>
    </div>
  );
}
