"use client";

import { useActionState } from "react";
import { manageChannel } from "./actions";

export function ClaimForm({
  action,
  channel,
  label,
  confirmation,
}: {
  action: "create" | "check" | "publish" | "hide" | "unlink";
  channel?: string;
  label: string;
  confirmation?: string;
}) {
  const [message, submit, pending] = useActionState(manageChannel, "");
  return (
    <form
      action={submit}
      className="form"
      onSubmit={(event) => {
        if (confirmation && !window.confirm(confirmation))
          event.preventDefault();
      }}
    >
      <input type="hidden" name="action" value={action} />
      {channel ? (
        <input type="hidden" name="channel" value={channel} />
      ) : (
        <label>
          YouTube 채널 ID 또는 주소
          <input name="channel" maxLength={240} required />
        </label>
      )}
      <button className="button outline" disabled={pending}>
        {pending ? "처리 중…" : label}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
