"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
const post = async (body: object) => {
  try {
    const res = await fetch("/api/admin/entitlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok
      ? null
      : ((await res.json()).error?.message ?? "처리하지 못했습니다.");
  } catch {
    return "네트워크 오류입니다.";
  }
};
export function GrantEntitlement({
  members,
  skus,
}: {
  members: { id: string; name: string; role: string }[];
  skus: string[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <form
      className="form-stack"
      aria-label="이용권 수동 발급"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const err = await post({
          action: "grant",
          owner: f.get("owner"),
          sku: f.get("sku"),
          days: Number(f.get("days")),
          credits: Number(f.get("credits")),
          note: f.get("note"),
        });
        setMessage(err ?? "발급했습니다.");
        if (!err) router.refresh();
      }}
    >
      <label className="field">
        회원
        <select name="owner" required>
          {members
            .filter((m) => m.role !== "admin")
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.role})
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        상품
        <select name="sku">
          {skus.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <div className="inline">
        <label className="field">
          기간(일)
          <input
            name="days"
            type="number"
            min={1}
            max={90}
            defaultValue={30}
            required
          />
        </label>
        <label className="field">
          크레딧
          <input
            name="credits"
            type="number"
            min={0}
            max={1000}
            defaultValue={0}
            required
          />
        </label>
      </div>
      <label className="field">
        발급 사유 (필수, 감사 기록)
        <input
          name="note"
          minLength={5}
          maxLength={300}
          required
          placeholder="예: TEST 장애 보상"
        />
      </label>
      <Button>TEST 이용권 발급</Button>
      <p role="status" style={{ fontSize: 13 }}>
        {message}
      </p>
    </form>
  );
}
export function RevokeEntitlement({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  return (
    <span className="inline">
      <input
        aria-label="회수 사유"
        value={note}
        minLength={5}
        maxLength={300}
        placeholder="회수 사유"
        onChange={(e) => setNote(e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={note.trim().length < 5}
        onClick={async () => {
          const err = await post({ action: "revoke", id, note });
          setMessage(err ?? "");
          if (!err) router.refresh();
        }}
      >
        회수
      </Button>
      {message && (
        <span role="alert" className="error">
          {message}
        </span>
      )}
    </span>
  );
}
