"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export type UploadRow = {
  id: string;
  original_name: string;
  mime: string;
  size_bytes: number;
  created_at: string;
};
const kb = (n: number) =>
  n < 1024 * 1024
    ? `${Math.ceil(n / 1024)}KB`
    : `${(n / 1024 / 1024).toFixed(1)}MB`;
export function PortfolioFiles({ files }: { files: UploadRow[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, setPending] = useState(false);
  const call = async (fn: () => Promise<Response>, ok: string) => {
    setPending(true);
    setMsg({});
    try {
      const res = await fn();
      const d = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(d.error?.message ?? "요청을 처리하지 못했습니다.");
      setMsg({ ok });
      router.refresh();
      return d;
    } catch (e) {
      setMsg({
        error: e instanceof Error ? e.message : "네트워크 오류입니다.",
      });
    } finally {
      setPending(false);
    }
  };
  return (
    <div style={{ marginTop: 55 }}>
      <h2>포트폴리오 파일</h2>
      <p>
        PNG·JPG·WEBP·PDF, 5MB 이하, 최대 20개. 파일은 비공개로 보관되며 본인만
        1분짜리 링크로 내려받을 수 있습니다.
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const ok = await call(
            () =>
              fetch("/api/uploads", {
                method: "POST",
                body: new FormData(form),
              }),
            "파일을 올렸습니다.",
          );
          if (ok) form.reset();
        }}
      >
        <label className="field">
          파일 선택
          <input
            name="file"
            type="file"
            required
            accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
          />
        </label>
        <label>
          <input name="rights" type="checkbox" required /> 직접 만들었거나
          사용할 권리가 있는 파일입니다.
        </label>
        <button className="button outline" disabled={pending}>
          {pending ? "처리 중…" : "파일 올리기"}
        </button>
      </form>
      {msg.ok && <p role="status">{msg.ok}</p>}
      {msg.error && (
        <p role="alert" className="error">
          {msg.error}
        </p>
      )}
      {files.length ? (
        <ul style={{ display: "grid", gap: 12, marginTop: 24 }}>
          {files.map((f) => (
            <li
              key={f.id}
              data-testid="upload-item"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span style={{ overflowWrap: "anywhere", flex: "1 1 200px" }}>
                {f.original_name} · {kb(f.size_bytes)}
              </span>
              <button
                type="button"
                className="button outline small"
                disabled={pending}
                onClick={async () => {
                  const d = await call(
                    () => fetch(`/api/uploads/${f.id}`, { method: "POST" }),
                    "",
                  );
                  if (d?.url) window.location.assign(d.url);
                }}
              >
                내려받기
              </button>
              <button
                type="button"
                className="button outline small"
                disabled={pending}
                onClick={() =>
                  call(
                    () => fetch(`/api/uploads/${f.id}`, { method: "DELETE" }),
                    "파일을 삭제했습니다.",
                  )
                }
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>올린 파일이 없습니다.</p>
      )}
    </div>
  );
}
