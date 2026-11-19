"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AccountForm({ name }: { name: string }) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="form-stack"
      style={{ marginBottom: 40 }}
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const res = await fetch("/api/account", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: new FormData(e.currentTarget).get("name"),
            }),
          });
          const d = await res.json();
          setMessage(res.ok ? "계정 이름을 저장했습니다." : d.error?.message);
          if (res.ok) router.refresh();
        } catch {
          setMessage("네트워크 오류입니다.");
        }
      }}
    >
      <label className="field">
        계정 표시 이름
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={name}
        />
      </label>
      <button className="button outline">계정 정보 저장</button>
      <p role="status">{message}</p>
    </form>
  );
}
