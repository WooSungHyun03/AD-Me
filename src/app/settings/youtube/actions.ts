"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { context } from "@/lib/api";
import { parseChannel } from "@/lib/intelligence";
import { getConfig } from "@/lib/config";

const choices = z.enum(["create", "check", "publish", "hide", "unlink"]);

export async function manageChannel(_: string, form: FormData) {
  const c = await context();
  if (c?.role !== "creator") return "크리에이터 계정이 필요합니다.";
  const action = choices.safeParse(form.get("action"));
  const raw = form.get("channel");
  const channel =
    typeof raw === "string" && raw.length <= 240 ? parseChannel(raw) : null;
  if (!action.success || !channel)
    return "YouTube 채널 ID 또는 채널 주소를 확인해주세요.";
  if (
    !["hide", "unlink"].includes(action.data) &&
    getConfig().features.ingestion !== "enabled"
  )
    return "현재 채널 연결과 확인 요청을 제공하지 않습니다.";
  const { error } = await c.db.rpc("ops_channel_owner", {
    p_action: action.data,
    p_channel: channel,
  });
  if (error?.code === "54000")
    return "채널 또는 검증 요청 한도에 도달했습니다.";
  if (error)
    return "요청을 반영할 수 없습니다. 채널과 인증 상태를 확인해주세요.";
  revalidatePath("/settings/youtube");
  if (action.data === "check")
    return "확인 작업을 등록했습니다. 잠시 후 화면을 새로고침해주세요.";
  return "저장했습니다.";
}
