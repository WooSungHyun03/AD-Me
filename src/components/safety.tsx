"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
function useCall() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, setPending] = useState(false);
  const call = async (url: string, body: unknown, ok: string) => {
    setPending(true);
    setMsg({});
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(d.error?.message ?? "요청을 처리하지 못했습니다.");
      setMsg({ ok });
      router.refresh();
      return true;
    } catch (e) {
      setMsg({
        error: e instanceof Error ? e.message : "네트워크 오류입니다.",
      });
      return false;
    } finally {
      setPending(false);
    }
  };
  const view = (
    <>
      {msg.ok && <p role="status">{msg.ok}</p>}
      {msg.error && (
        <p role="alert" className="error">
          {msg.error}
        </p>
      )}
    </>
  );
  return { call, pending, view };
}
// Two-step confirm in the page itself (no browser dialogs).
export function BlockButton({ proposalId }: { proposalId: string }) {
  const { call, pending, view } = useCall();
  const [confirm, setConfirm] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      {confirm ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span>진행 중인 요청이 닫히고 서로 연락할 수 없게 됩니다.</span>
          <button
            type="button"
            className="button outline small"
            disabled={pending}
            onClick={() =>
              call(
                "/api/safety",
                { action: "block", proposalId },
                "상대를 차단했습니다.",
              )
            }
          >
            차단 확정
          </button>
          <button
            type="button"
            className="button outline small"
            onClick={() => setConfirm(false)}
          >
            취소
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="button outline small"
          onClick={() => setConfirm(true)}
        >
          상대 차단
        </button>
      )}
      {view}
    </div>
  );
}
export function UnblockButton({ userId }: { userId: string }) {
  const { call, pending, view } = useCall();
  return (
    <>
      <button
        type="button"
        className="button outline small"
        disabled={pending}
        onClick={() =>
          call(
            "/api/safety",
            { action: "unblock", userId },
            "차단을 해제했습니다.",
          )
        }
      >
        차단 해제
      </button>
      {view}
    </>
  );
}
export function RestrictionAppeal({
  restrictionId,
}: {
  restrictionId: string;
}) {
  const { call, pending, view } = useCall();
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const text = String(new FormData(e.currentTarget).get("text") ?? "");
        call(
          "/api/safety",
          { action: "appeal", restrictionId, text },
          "이의신청을 접수했습니다. 운영자가 검토합니다.",
        );
      }}
    >
      <label className="field">
        이의신청 사유
        <textarea
          name="text"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
        />
      </label>
      <button className="button outline small" disabled={pending}>
        이의신청하기
      </button>
      {view}
    </form>
  );
}
export function AdminRestrict({ reportId }: { reportId: string }) {
  const { call, pending, view } = useCall();
  const [reason, setReason] = useState("");
  return (
    <div className="form-stack" style={{ marginTop: 12 }}>
      <label className="field">
        연락 제한 사유 (계정 소유 프로필만, 최대 30일)
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {([1, 7, 30] as const).map((days) => (
          <button
            key={days}
            type="button"
            className="button outline small"
            disabled={pending}
            onClick={() =>
              call(
                "/api/admin/restrict",
                { action: "restrict", reportId, days, reason },
                `${days}일 연락 제한을 적용했습니다.`,
              )
            }
          >
            {days}일 연락 제한
          </button>
        ))}
      </div>
      {view}
    </div>
  );
}
export function LiftRestriction({ restrictionId }: { restrictionId: string }) {
  const { call, pending, view } = useCall();
  return (
    <>
      <button
        type="button"
        className="button outline small"
        disabled={pending}
        onClick={() =>
          call(
            "/api/admin/restrict",
            { action: "lift", restrictionId },
            "제한을 해제했습니다.",
          )
        }
      >
        제한 해제
      </button>
      {view}
    </>
  );
}

// D079: admin runs the retention job / re-applies deletions after a backup restore (both are retry-safe).
export function RetentionControls() {
  const { call, pending, view } = useCall();
  return (
    <>
      <div className="inline">
        <button
          type="button"
          className="button outline small"
          disabled={pending}
          onClick={() =>
            call(
              "/api/admin/retention",
              { action: "run" },
              "보존 작업을 실행했습니다.",
            )
          }
        >
          보존 작업 실행
        </button>
        <button
          type="button"
          className="button outline small"
          disabled={pending}
          onClick={() =>
            call(
              "/api/admin/retention",
              { action: "reapply" },
              "삭제 표시를 다시 적용했습니다.",
            )
          }
        >
          복구 후 삭제 재적용
        </button>
      </div>
      {view}
    </>
  );
}
