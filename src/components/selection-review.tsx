"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
type Item = { id: string; label: string };
const send = async (url: string, method: string, body: object) => {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    return res.ok ? null : (d.error?.message ?? "저장하지 못했습니다.");
  } catch {
    return "네트워크 오류입니다.";
  }
};
export function ChecklistEditor({ items }: { items: Item[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  return (
    <div aria-label="검토 체크리스트" role="group">
      {items.map((i) => (
        <div className="inline" key={i.id} style={{ fontSize: 13 }}>
          <span>{i.label}</span>
          <button
            className="button outline small"
            aria-label={`${i.label} 항목 삭제`}
            onClick={async () => {
              const err = await send("/api/notes/checklist", "DELETE", {
                id: i.id,
              });
              setMessage(err ?? "삭제했습니다.");
              if (!err) router.refresh();
            }}
          >
            삭제
          </button>
        </div>
      ))}
      <form
        className="inline"
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await send("/api/notes/checklist", "POST", { label });
          setMessage(
            err ??
              "추가했습니다. 기존 승인은 새 항목을 확인할 때까지 효력이 없습니다.",
          );
          if (!err) {
            setLabel("");
            router.refresh();
          }
        }}
      >
        <input
          aria-label="새 체크 항목"
          value={label}
          maxLength={100}
          required
          placeholder="예: 광고 표기 이행 이력 확인"
          onChange={(e) => setLabel(e.target.value)}
        />
        <button className="button outline small">항목 추가</button>
      </form>
      <p role="status" style={{ fontSize: 13 }}>
        {message}
      </p>
    </div>
  );
}
export function ReviewForm({
  campaignId,
  creatorId,
  name,
  items,
  review,
}: {
  campaignId: string;
  creatorId: string;
  name: string;
  items: Item[];
  review?: {
    checked: string[];
    memo: string;
    approved: boolean;
    reviewed_at: string | null;
  };
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<string[]>(review?.checked ?? []);
  const [memo, setMemo] = useState(review?.memo ?? "");
  const [message, setMessage] = useState("");
  const covered = items.every((i) => checked.includes(i.id));
  const approved = !!review?.approved && covered;
  const save = async (approve: boolean) => {
    const err = await send("/api/notes/review", "POST", {
      campaignId,
      creatorId,
      checked,
      memo,
      approve,
    });
    setMessage(
      err ??
        (approve ? "승인했습니다. 이제 선정할 수 있습니다." : "저장했습니다."),
    );
    if (!err) router.refresh();
  };
  return (
    <form
      className="panel"
      style={{ marginBottom: 16 }}
      aria-label={`${name} 선정 검토`}
      onSubmit={(e) => e.preventDefault()}
    >
      <strong>{name}</strong>{" "}
      <span className={approved ? "badge lime" : "badge"}>
        {approved
          ? `승인됨 · ${new Date(review!.reviewed_at!).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}`
          : "미승인"}
      </span>
      {items.map((i) => (
        <label
          className="inline"
          key={i.id}
          style={{ flexWrap: "nowrap", fontSize: 13 }}
        >
          <input
            type="checkbox"
            checked={checked.includes(i.id)}
            onChange={(e) =>
              setChecked(
                e.target.checked
                  ? [...checked, i.id]
                  : checked.filter((x) => x !== i.id),
              )
            }
          />
          {i.label}
        </label>
      ))}
      <label className="field" style={{ fontSize: 13 }}>
        검토 메모 (비공개)
        <textarea
          value={memo}
          maxLength={1000}
          rows={2}
          onChange={(e) => setMemo(e.target.value)}
        />
      </label>
      <div className="inline">
        <button
          type="button"
          className="button outline small"
          onClick={() => save(false)}
        >
          저장
        </button>
        <button
          type="button"
          className="button small"
          disabled={!covered}
          onClick={() => save(true)}
        >
          선정 승인
        </button>
      </div>
      <p role="status" style={{ fontSize: 13 }}>
        {message}
      </p>
    </form>
  );
}
