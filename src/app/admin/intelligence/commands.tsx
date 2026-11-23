"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { roles } from "@/lib/intelligence";

export function Command({
  action,
  fixedValue,
  keyword,
  enabled,
}: {
  action: "channel" | "review" | "discovery" | "staff";
  fixedValue?: string;
  keyword?: string;
  enabled?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = fixedValue ?? String(form.get("value") ?? "");
    const extra = form.get("extra");
    if (
      action === "staff" &&
      !window.confirm("이 회원의 운영 역할을 변경할까요?")
    )
      return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, value, extra }),
      });
      const data = await response.json();
      setMessage(
        response.ok
          ? "저장했습니다."
          : (data.error?.message ?? "요청에 실패했습니다."),
      );
      if (response.ok) router.refresh();
    } catch {
      setMessage("연결을 확인한 뒤 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="form ops-form">
      {action === "channel" && (
        <label>
          채널 ID 또는 채널 주소
          <input
            name="value"
            required
            maxLength={240}
            placeholder="https://www.youtube.com/channel/UC…"
          />
        </label>
      )}
      {action === "discovery" && (
        <>
          <label>
            발굴 키워드
            <input
              name="value"
              required
              minLength={2}
              maxLength={80}
              defaultValue={keyword}
            />
          </label>
          <label>
            일일 발굴·갱신
            <select name="extra" defaultValue={String(enabled ?? false)}>
              <option value="false">중지</option>
              <option value="true">매일 오전 4시 (한국 시간)</option>
            </select>
          </label>
        </>
      )}
      {action === "review" && (
        <label>
          검토 결과
          <select name="extra" defaultValue="pending">
            <option value="pending">검토 대기</option>
            <option value="accepted">내부 검토 승인</option>
            <option value="rejected">반려</option>
          </select>
        </label>
      )}
      {action === "staff" && (
        <>
          <label>
            회원 ID
            <input name="value" required maxLength={36} />
          </label>
          <label>
            운영 역할
            <select name="extra" defaultValue="support">
              {roles
                .filter((role) => role !== "super")
                .map((role) => (
                  <option key={role}>{role}</option>
                ))}
              <option value="remove">부여한 역할 제거</option>
            </select>
          </label>
          <p>
            초대는 7일 동안 유효합니다. 초대받은 운영자도 OTP 인증이 필요합니다.
          </p>
        </>
      )}
      <button type="submit" className="button outline" disabled={pending}>
        {pending
          ? "저장 중…"
          : action === "channel"
            ? "수집 작업 등록"
            : "저장"}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
