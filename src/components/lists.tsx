"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(d.error?.message ?? "요청을 처리하지 못했습니다.");
  return d;
}
function useAction() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const run = async (fn: () => Promise<unknown>, ok = "") => {
    setMessage("");
    try {
      await fn();
      setMessage(ok);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "네트워크 오류입니다.");
    }
  };
  return { message, run };
}
export function NewListForm() {
  const { message, run } = useAction();
  return (
    <form
      className="inline"
      onSubmit={(e) => {
        e.preventDefault();
        const f = e.currentTarget;
        const name = String(new FormData(f).get("name"));
        run(
          () => call("/api/lists", "POST", { name }).then(() => f.reset()),
          "그룹을 만들었습니다.",
        );
      }}
    >
      <label className="field">
        새 후보 그룹 이름
        <input
          name="name"
          required
          maxLength={60}
          placeholder="예: 여름 시즌 후보"
        />
      </label>
      <button className="button primary small">그룹 만들기</button>
      <span role="status">{message}</span>
    </form>
  );
}
export function ListControls({
  id,
  name,
  locked,
}: {
  id: string;
  name: string;
  locked: boolean;
}) {
  const { message, run } = useAction();
  return (
    <span className="inline">
      {!locked && (
        <>
          <form
            className="inline"
            onSubmit={(e) => {
              e.preventDefault();
              const next = String(new FormData(e.currentTarget).get("name"));
              run(
                () => call("/api/lists", "PATCH", { id, name: next }),
                "이름을 바꿨습니다.",
              );
            }}
          >
            <input
              name="name"
              aria-label={`${name} 새 이름`}
              defaultValue={name}
              required
              maxLength={60}
            />
            <button className="button outline small">이름 저장</button>
          </form>
          <button
            className="button outline small"
            onClick={() => run(() => call(`/api/lists?id=${id}`, "DELETE"))}
          >
            그룹 삭제
          </button>
        </>
      )}
      <a className="button outline small" href={`/api/export?list=${id}`}>
        CSV
      </a>
      <span role="status">{message}</span>
    </span>
  );
}
export function RemoveItem({
  listId,
  creatorId,
  name,
}: {
  listId: string;
  creatorId: string;
  name: string;
}) {
  const { run } = useAction();
  return (
    <button
      className="button ghost small"
      aria-label={`${name} 그룹에서 빼기`}
      onClick={() =>
        run(() => call("/api/lists/items", "DELETE", { listId, creatorId }))
      }
    >
      빼기
    </button>
  );
}
export function AddToList({
  creatorId,
  lists,
}: {
  creatorId: string;
  lists: { id: string; name: string }[];
}) {
  const { message, run } = useAction();
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  if (!lists.length) return null;
  return (
    <div className="inline" style={{ marginTop: 12 }}>
      <label className="field">
        후보 그룹
        <select value={listId} onChange={(e) => setListId(e.target.value)}>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="button outline small"
        onClick={() =>
          run(
            () => call("/api/lists/items", "POST", { listId, creatorId }),
            "그룹에 추가했습니다.",
          )
        }
      >
        그룹에 추가
      </button>
      <span role="status">{message}</span>
    </div>
  );
}
// Campaign shortlist: creates the campaign's list on first use (RLS checks campaign ownership).
export function ShortlistButton({
  campaignId,
  listId,
  creatorId,
  name,
  title,
}: {
  campaignId: string;
  listId: string | null;
  creatorId: string;
  name: string;
  title: string;
}) {
  const { message, run } = useAction();
  return (
    <span className="inline">
      <button
        className="button outline small"
        aria-label={`${name} 캠페인 후보에 담기`}
        onClick={() =>
          run(async () => {
            const id =
              listId ??
              (
                await call("/api/lists", "POST", {
                  name: `${title.slice(0, 50)} 후보`,
                  campaignId,
                })
              ).id;
            await call("/api/lists/items", "POST", { listId: id, creatorId });
          })
        }
      >
        후보에 담기
      </button>
      {message && (
        <span role="alert" className="error" style={{ fontSize: 12 }}>
          {message}
        </span>
      )}
    </span>
  );
}
type ImportResult = {
  committed: boolean;
  summary: { ok: number; exists: number; error: number };
  rows: { line: number; id: string; status: string; message?: string }[];
};
const STATUS = { ok: "추가 가능", exists: "이미 있음", error: "오류" } as const;
// D038: choose file → preview (nothing saved) → confirm adds only the valid rows.
export function ImportCsv({ listId, name }: { listId: string; name: string }) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState("");
  const send = async (action: "preview" | "commit") => {
    setMessage("");
    try {
      const r: ImportResult = await call("/api/import", "POST", {
        action,
        listId,
        csv,
      });
      setResult(r);
      if (action === "commit") {
        setMessage(
          `${r.summary.ok}명을 추가했습니다. 오류 ${r.summary.error}행은 추가하지 않았습니다.`,
        );
        setCsv("");
        router.refresh();
      }
    } catch (e) {
      setResult(null);
      setMessage(e instanceof Error ? e.message : "네트워크 오류입니다.");
    }
  };
  return (
    <details style={{ marginTop: 12 }}>
      <summary>CSV로 후보 가져오기</summary>
      <p style={{ fontSize: 13 }}>
        내보낸 CSV나 <a href="/api/import">템플릿</a>의 ID·출처 열만 읽습니다.
        최대 500행·100KB, UTF-8. 링크(URL)는 가져오거나 수집하지 않습니다.
      </p>
      <label className="field">
        {name} CSV 파일
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            setResult(null);
            setMessage("");
            if (!f) return setCsv("");
            if (f.size > 100_000) return setMessage("파일이 100KB를 넘습니다.");
            setCsv(await f.text());
          }}
        />
      </label>
      <div className="inline">
        <button
          type="button"
          className="button outline small"
          disabled={!csv}
          onClick={() => send("preview")}
        >
          미리보기
        </button>
        <button
          type="button"
          className="button primary small"
          disabled={!csv || !result || result.committed || !result.summary.ok}
          onClick={() => send("commit")}
        >
          확인 후 추가
        </button>
      </div>
      <p role="status">{message}</p>
      {result && (
        <>
          <p style={{ fontSize: 13 }}>
            추가 가능 {result.summary.ok} · 이미 있음 {result.summary.exists} ·
            오류 {result.summary.error}
          </p>
          <ul
            data-testid="import-preview"
            style={{ listStyle: "none", padding: 0, fontSize: 13 }}
          >
            {result.rows.map((r) => (
              <li
                key={r.line}
                style={{
                  borderTop: "1px solid var(--line)",
                  padding: "8px 0",
                  overflowWrap: "anywhere",
                }}
              >
                <strong>
                  {r.line}행 · {STATUS[r.status as keyof typeof STATUS]}
                </strong>{" "}
                <code>{r.id || "(빈 ID)"}</code>
                {r.message && <div>{r.message}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
