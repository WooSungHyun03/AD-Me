"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(d.error?.message ?? "요청을 처리하지 못했습니다.");
  return d;
}
// Private note: saved to the owner-only notes table, never into proposal messages or shared links.
export function NoteEditor({
  creatorId,
  name,
  body,
}: {
  creatorId: string;
  name: string;
  body: string;
}) {
  const [message, setMessage] = useState("");
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await send("/api/notes", "PUT", {
            creatorId,
            body: new FormData(e.currentTarget).get("body"),
          });
          setMessage("저장했습니다.");
        } catch (err) {
          setMessage(
            err instanceof Error ? err.message : "네트워크 오류입니다.",
          );
        }
      }}
    >
      <label className="field">
        {name} 비공개 메모
        <textarea name="body" maxLength={2000} rows={3} defaultValue={body} />
      </label>
      <button className="button outline small">메모 저장</button>
      <span role="status">{message}</span>
    </form>
  );
}
export function SaveCompare({ ids }: { ids: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <form
      className="inline"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await send("/api/compare", "POST", {
            ids,
            title: f.get("title"),
            share: f.get("share"),
          });
          setMessage("비교를 저장했습니다.");
          router.refresh();
        } catch (err) {
          setMessage(
            err instanceof Error ? err.message : "네트워크 오류입니다.",
          );
        }
      }}
    >
      <label className="field">
        비교 제목
        <input
          name="title"
          required
          maxLength={80}
          placeholder="예: 여름 캠페인 후보"
        />
      </label>
      <label className="field">
        공유 범위
        <select name="share" defaultValue="private">
          <option value="private">나만 보기</option>
          <option value="link">링크가 있는 사람(메모 제외)</option>
        </select>
      </label>
      <button className="button primary small">비교 저장</button>
      <span role="status">{message}</span>
    </form>
  );
}
export function ShareToggle({ id, shared }: { id: string; shared: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="button outline small"
      onClick={async () => {
        await send("/api/compare", "PATCH", {
          id,
          share: shared ? "private" : "link",
        }).catch(() => null);
        router.refresh();
      }}
    >
      {shared ? "공유 끄기" : "링크 공유 켜기"}
    </button>
  );
}
