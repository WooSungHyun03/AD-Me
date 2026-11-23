"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AccountForm({
  name,
  optOut,
}: {
  name: string;
  optOut: boolean;
}) {
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
              analytics_opt_out: new FormData(e.currentTarget).has("optout"),
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
      <label className="inline" style={{ flexWrap: "nowrap" }}>
        <input type="checkbox" name="optout" defaultChecked={optOut} />
        서비스 개선용 이용 통계(가명 처리, 원문 미수집)에서 제외하고 지난 기록
        삭제
      </label>
      <button className="button outline">계정 정보 저장</button>
      <p role="status">{message}</p>
    </form>
  );
}

export function PreferencesForm({
  serviceEmail,
  marketingEmail,
  marketingAt,
  interests,
  categories,
  purposes,
}: {
  serviceEmail: boolean;
  marketingEmail: boolean;
  marketingAt: string | null;
  interests: string[];
  categories: string[];
  purposes: Record<"service_email" | "marketing_email" | "interests", string>;
}) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="form-stack"
      style={{ marginBottom: 40 }}
      aria-label="알림·관심 분야"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const picked = f.getAll("interest").map(String);
        if (picked.length > 5)
          return setMessage("관심 분야는 최대 5개까지 고를 수 있습니다.");
        try {
          const res = await fetch("/api/account", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_email: f.has("service_email"),
              marketing_email: f.has("marketing_email"),
              interests: picked,
            }),
          });
          const d = await res.json();
          setMessage(res.ok ? "알림 설정을 저장했습니다." : d.error?.message);
          if (res.ok) router.refresh();
        } catch {
          setMessage("네트워크 오류입니다.");
        }
      }}
    >
      <h2>알림·관심 분야</h2>
      <label className="inline" style={{ flexWrap: "nowrap" }}>
        <input
          type="checkbox"
          name="service_email"
          defaultChecked={serviceEmail}
        />
        {purposes.service_email}
      </label>
      <label className="inline" style={{ flexWrap: "nowrap" }}>
        <input
          type="checkbox"
          name="marketing_email"
          defaultChecked={marketingEmail}
        />
        {purposes.marketing_email}
      </label>
      {marketingEmail && marketingAt && (
        <p style={{ fontSize: 12, color: "var(--muted)" }}>
          마케팅 수신 동의일:{" "}
          {new Date(marketingAt).toLocaleDateString("ko-KR")}
        </p>
      )}
      <fieldset>
        <legend>{purposes.interests}</legend>
        <div className="inline">
          {categories.map((c) => (
            <label key={c} className="inline">
              <input
                type="checkbox"
                name="interest"
                value={c}
                defaultChecked={interests.includes(c)}
              />
              {c}
            </label>
          ))}
        </div>
      </fieldset>
      <button className="button outline">알림 설정 저장</button>
      <p role="status">{message}</p>
    </form>
  );
}
