"use client";

import { useActionState } from "react";
import { updateContact } from "./contact-actions";

export function ContactForm({
  id,
  email = "",
  phone = "",
  consent = false,
}: {
  id: string;
  email?: string;
  phone?: string;
  consent?: boolean;
}) {
  const [state, action, pending] = useActionState(updateContact, {
    message: "",
    ok: false,
  });
  return (
    <form className="form ops-form" action={action}>
      <h3>업무 연락처</h3>
      <input type="hidden" name="channelId" value={id} />
      <label className="field">
        업무 이메일
        <input name="email" type="email" defaultValue={email} maxLength={254} />
      </label>
      <label className="field">
        업무 전화번호 (선택)
        <input name="phone" type="tel" defaultValue={phone} maxLength={30} />
      </label>
      <label>
        <input name="consent" type="checkbox" defaultChecked={consent} />{" "}
        방문자가 볼 수 있도록 연락처 공개에 동의합니다.
      </label>
      <button className="button outline" disabled={pending}>
        연락처 저장
      </button>
      {state.message && (
        <p role={state.ok ? "status" : "alert"}>{state.message}</p>
      )}
    </form>
  );
}
