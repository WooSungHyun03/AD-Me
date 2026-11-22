"use client";
import { useState } from "react";
import { Button } from "./ui/button";
export function Unsubscribe({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className="form-stack">
      <Button
        onClick={async () => {
          try {
            const res = await fetch("/api/email/unsubscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });
            const d = await res.json();
            setMessage(
              res.ok
                ? `${d.purpose === "marketing" ? "마케팅" : "서비스 알림"} 메일 수신을 껐습니다.`
                : d.error?.message,
            );
          } catch {
            setMessage("네트워크 오류입니다.");
          }
        }}
      >
        수신 거부
      </Button>
      <p role="status">{message}</p>
    </div>
  );
}
