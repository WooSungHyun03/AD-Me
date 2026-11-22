"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export function LiveMessages() {
  const router = useRouter();
  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!endpoint || !key) return;
    const client = createBrowserClient(endpoint, key);
    let timer: ReturnType<typeof setTimeout> | undefined;
    function refresh() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    }
    const channel = client
      .channel("workspace-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        refresh,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    return () => {
      if (timer) clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, [router]);
  return null;
}

export function ChatSafety({ id }: { id: string }) {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const button = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const action = button?.value;
    if (!action) return;
    const reason = new FormData(event.currentTarget).get("reason");
    setPending(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, reason }),
      });
      setStatus(
        response.ok
          ? ({
              block: "대화가 차단됐습니다.",
              unblock: "내가 설정한 차단을 해제했습니다.",
              report: "운영팀에 신고를 접수했습니다.",
            }[action] ?? "저장했습니다.")
          : "대화 권한과 신고 내용을 확인해주세요.",
      );
    } catch {
      setStatus("연결에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="ops-row">
      <summary>대화 차단·신고</summary>
      <form className="form ops-form" onSubmit={submit}>
        <label>
          신고 사유 (5자 이상)
          <textarea name="reason" maxLength={500} rows={2} />
        </label>
        <div className="inline">
          <button
            className="button outline small"
            value="report"
            disabled={pending}
          >
            신고
          </button>
          <button
            className="button outline small"
            value="block"
            disabled={pending}
          >
            대화 차단
          </button>
          <button
            className="button outline small"
            value="unblock"
            disabled={pending}
          >
            내 차단 해제
          </button>
        </div>
        {status && <p role="status">{status}</p>}
      </form>
    </details>
  );
}
