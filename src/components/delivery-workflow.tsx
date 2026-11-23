"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DeliveryPage } from "@/lib/deliverables";
class DeliveryFailure extends Error {}
function DeclarationFields() {
  return (
    <>
      <label className="field">
        광고 표시 상태
        <select name="declaration" aria-label="광고 표시 상태">
          <option value="marked">경제적 이해관계 표시를 확인했습니다</option>
          <option value="not_applicable">광고 표시 대상이 아닙니다</option>
        </select>
      </label>
      <label>
        <input type="checkbox" name="confirmed" required /> 현재 제출본의 표시
        상태를 직접 확인했습니다.
      </label>
    </>
  );
}
export function DeliveryWorkflow({ data }: { data: DeliveryPage }) {
  const router = useRouter(),
    busy = useRef(false),
    retry = useRef<{ signature: string; key: string } | null>(null);
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [checked, setChecked] = useState(false);
  async function send(
    path: string,
    method: string,
    payload: Record<string, unknown>,
    withKey: boolean,
  ) {
    if (busy.current) return;
    const signature = JSON.stringify({ path, method, ...payload });
    if (withKey && retry.current?.signature !== signature)
      retry.current = { signature, key: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          ...(withKey ? { clientKey: retry.current!.key } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok)
        throw new DeliveryFailure(
          body.error?.message || "처리하지 못했습니다.",
        );
      retry.current = null;
      setMessage("저장되었습니다.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof DeliveryFailure
          ? error.message
          : "전송 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도해주세요.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const active = data.active,
    shared = {
      id: data.proposalId,
      submissionId: active?.id,
      expectedVersion: data.roomRevision,
    };
  return (
    <div className="form-stack">
      {data.legacyCompleted && (
        <p className="notice">
          이전 협업에서 완료된 기록입니다. 제출본별 광고 표시 확인과 검토 근거는
          확보되지 않았습니다.
        </p>
      )}
      {active ? (
        <article
          className="panel"
          data-testid="active-submission"
          style={{ overflowWrap: "anywhere" }}
        >
          <h2>현재 검토 대상 · 버전 {active.version}</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{active.body}</p>
          {active.url ? (
            <a href={active.url} target="_blank" rel="noopener noreferrer">
              현재 결과물 열기 ↗
            </a>
          ) : (
            <p>확인할 수 있는 HTTPS 링크가 없습니다.</p>
          )}
          <p>
            {active.attestation
              ? `제출자 표시 확인: ${active.attestation.declaration === "marked" ? "표시 확인" : "해당 없음"}`
              : "제출자의 광고 표시 확인이 필요합니다."}
          </p>
        </article>
      ) : (
        <p className="notice">아직 등록된 결과물이 없습니다.</p>
      )}
      {data.needsNewVersion && (
        <p className="notice">
          수정 요청된 제출본입니다. 새 버전을 등록한 뒤 다시 제출해주세요.
        </p>
      )}
      {data.canCreate && (
        <form
          className="panel form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void send(
              "/api/deliverables",
              "POST",
              {
                proposalId: data.proposalId,
                expectedVersion: data.roomRevision,
                body: f.get("body"),
                url: f.get("url"),
                declaration: f.get("declaration"),
                confirmed: f.get("confirmed") === "on",
              },
              true,
            );
          }}
        >
          <h2>새 제출본 등록</h2>
          <label className="field">
            결과물 설명
            <textarea
              name="body"
              required
              maxLength={3000}
              disabled={pending}
            />
          </label>
          <label className="field">
            결과물 HTTPS 링크
            <input
              name="url"
              type="url"
              required
              maxLength={1000}
              disabled={pending}
              placeholder="https://"
            />
          </label>
          <DeclarationFields />
          <button className="button primary" disabled={pending}>
            새 제출본 저장
          </button>
        </form>
      )}
      {data.canAttest && active && (
        <form
          className="panel form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void send(
              "/api/deliverables",
              "PATCH",
              {
                proposalId: data.proposalId,
                submissionId: active.id,
                expectedVersion: data.roomRevision,
                declaration: f.get("declaration"),
                confirmed: f.get("confirmed") === "on",
              },
              false,
            );
          }}
        >
          <h2>이전 제출본 표시 확인</h2>
          <DeclarationFields />
          <button className="button outline" disabled={pending}>
            현재 제출본 표시 확인 저장
          </button>
        </form>
      )}
      {data.canSubmit && active?.url && (
        <button
          className="button primary"
          disabled={pending}
          onClick={() =>
            void send(
              "/api/proposals",
              "PATCH",
              {
                ...shared,
                action: "submitted",
                reviewNote: "",
                advertisingChecked: false,
              },
              true,
            )
          }
        >
          현재 버전 제출 완료
        </button>
      )}
      {data.canReview && active && (
        <form
          className="panel form-stack"
          data-testid="delivery-review-form"
          onSubmit={(e) => {
            e.preventDefault();
            const action =
              (e.nativeEvent as SubmitEvent).submitter instanceof
              HTMLButtonElement
                ? ((e.nativeEvent as SubmitEvent)
                    .submitter as HTMLButtonElement)
                : null;
            const f = new FormData(e.currentTarget);
            void send(
              "/api/proposals",
              "PATCH",
              {
                ...shared,
                action: action?.value,
                reviewNote: f.get("reviewNote"),
                advertisingChecked: checked,
              },
              true,
            );
          }}
        >
          <h2>버전 {active.version} 검토</h2>
          <label className="field">
            검토 의견·승인 근거
            <textarea
              name="reviewNote"
              required
              minLength={10}
              maxLength={2000}
              disabled={pending}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={pending}
            />{" "}
            현재 제출본의 광고 표시를 확인했습니다.
          </label>
          <div className="inline">
            <button
              className="button outline"
              value="revision_requested"
              disabled={pending}
            >
              수정 요청
            </button>
            <button
              className="button primary"
              value="completed"
              disabled={
                pending ||
                !checked ||
                !active.attestation ||
                !active.url ||
                data.needsNewVersion
              }
            >
              현재 버전 검토 승인
            </button>
          </div>
        </form>
      )}
      <p role="status">{message}</p>
      <button
        className="button ghost small"
        disabled={pending}
        onClick={() => router.refresh()}
      >
        최신 상태 새로고침
      </button>
      <h2>제출·검토 이력</h2>
      <p className="muted">
        등록한 링크와 설명을 버전별로 보존합니다. 외부 링크의 실제 내용은 변경될
        수 있습니다.
      </p>
      {data.items.map((s) => (
        <article
          className="notice"
          key={s.id}
          data-testid="submission-history"
          style={{ overflowWrap: "anywhere" }}
        >
          <h3>
            버전 {s.version}
            {s.legacy ? " · 이전 제출 기록" : ""}
          </h3>
          <time dateTime={s.createdAt}>
            {new Date(s.createdAt).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}
          </time>
          <p style={{ whiteSpace: "pre-wrap" }}>{s.body}</p>
          {s.url && (
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              이 버전 결과물 열기 ↗
            </a>
          )}
          <p>
            {s.attestation
              ? `표시 확인: ${s.attestation.declaration === "marked" ? "표시 확인" : "해당 없음"}`
              : "광고 표시 확인 기록 없음"}
          </p>
          {s.events.map((e, i) => (
            <div key={i}>
              <strong>
                {
                  {
                    submitted: "검토 요청",
                    revision_requested: "브랜드 수정 요청",
                    completed: "브랜드 검토 승인",
                  }[e.action]
                }
              </strong>
              <p>{e.note}</p>
              <time dateTime={e.createdAt}>
                {new Date(e.createdAt).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </time>
              {e.action !== "submitted" && (
                <p>
                  브랜드 표시 확인:{" "}
                  {e.advertisingChecked ? "확인" : "확인 전·수정 요청"}
                </p>
              )}
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}
