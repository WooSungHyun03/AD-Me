"use client";

import { useActionState } from "react";
import { Bookmark } from "lucide-react";
import { saveChannel } from "@/app/creators/youtube/[id]/actions";

export function SaveYoutubeChannel({
  id,
  saved,
}: {
  id: string;
  saved: boolean;
}) {
  const [error, action, pending] = useActionState(
    () => saveChannel(id, !saved),
    "",
  );
  return (
    <form action={action}>
      <button
        className="button outline"
        disabled={pending}
        aria-pressed={saved}
      >
        <Bookmark size={16} aria-hidden="true" />
        {pending ? "저장 상태 변경 중…" : saved ? "저장됨" : "관심 채널 저장"}
      </button>
      {error && <small role="alert">{error}</small>}
    </form>
  );
}
