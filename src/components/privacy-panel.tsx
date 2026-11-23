"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { REAUTH_MESSAGE } from "@/lib/auth-links";
async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error?.message ?? "요청을 처리하지 못했습니다.");
  }
  return res;
}
// Ticket and file are fetched back to back; the one-time token only lives in memory for these two requests.
export function PrivacyExport() {
  const router = useRouter();
  const [state, setState] = useState<{ ok?: string; error?: string }>({});
  const [pending, setPending] = useState(false);
  const run = async () => {
    setPending(true);
    setState({});
    try {
      const t = await (await post("/api/privacy/exports")).json();
      const res = await post("/api/privacy/download", {
        id: t.id,
        token: t.token,
      });
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        "adme-my-data.json";
      a.click();
      URL.revokeObjectURL(url);
      setState({
        ok: "내 데이터 파일을 내려받았습니다. 내보내기 링크는 한 번만 쓸 수 있습니다.",
      });
      router.refresh();
    } catch (e) {
      setState({
        error: e instanceof Error ? e.message : "네트워크 오류입니다.",
      });
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="form-stack">
      <button
        type="button"
        className="button outline"
        onClick={run}
        disabled={pending}
      >
        {pending ? "준비 중…" : "내 데이터 내보내기 (JSON)"}
      </button>
      {state.ok && <p role="status">{state.ok}</p>}
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state.error === REAUTH_MESSAGE && (
        <Link href="/login?next=/settings&reauth=1">다시 로그인하기 →</Link>
      )}
    </div>
  );
}
