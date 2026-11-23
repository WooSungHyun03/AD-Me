"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { inquiryCategories } from "@/lib/schemas";
export function InquiryForm({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <form
      className="form-stack"
      aria-label="문의하기"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        try {
          const res = await fetch("/api/inquiries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: f.get("category"),
              message: f.get("message"),
              email: f.get("email") ?? "",
            }),
          });
          const d = await res.json();
          if (!res.ok)
            return setMessage(d.error?.message ?? "접수하지 못했습니다.");
          form.reset();
          setMessage(
            signedIn
              ? "접수했습니다. 답변은 이 페이지의 '내 문의'에 표시됩니다."
              : "접수했습니다. 입력한 이메일로 운영자가 직접 답변합니다.",
          );
          router.refresh();
        } catch {
          setMessage("네트워크 오류입니다.");
        }
      }}
    >
      <label className="field">
        문의 유형
        <select name="category" defaultValue="usage">
          {Object.entries(inquiryCategories).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        문의 내용 (10~2000자)
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
        />
      </label>
      {!signedIn && (
        <label className="field">
          답변받을 이메일
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
          />
        </label>
      )}
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        비밀번호·결제 정보·주민등록번호는 적지 마세요. 문의 내용은 답변과 운영
        개선에만 사용합니다.
      </p>
      <Button>문의 보내기</Button>
      <p role="status" style={{ fontSize: 13 }}>
        {message}
      </p>
    </form>
  );
}
export function AnswerInquiry({ id }: { id: string }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const send = async (close: boolean) => {
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, answer, close }),
      });
      const d = await res.json();
      if (!res.ok)
        return setMessage(d.error?.message ?? "처리하지 못했습니다.");
      router.refresh();
    } catch {
      setMessage("네트워크 오류입니다.");
    }
  };
  return (
    <div className="form-stack">
      <label className="field" style={{ fontSize: 13 }}>
        답변
        <textarea
          value={answer}
          maxLength={2000}
          rows={2}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </label>
      <div className="inline">
        <Button type="button" onClick={() => send(false)}>
          답변 저장
        </Button>
        <Button type="button" variant="outline" onClick={() => send(true)}>
          종료
        </Button>
      </div>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
    </div>
  );
}
