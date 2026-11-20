import { NextResponse } from "next/server";
import {
  apiRoute,
  failDatabase,
  parseBody,
  requireContext,
  requireFeature,
} from "@/lib/api";
import { opsCommand } from "@/lib/intelligence";

export const POST = apiRoute("admin.intelligence.post", async (request) => {
  const c = await requireContext();
  const data = await parseBody(
    request,
    opsCommand,
    "입력한 값과 채널 주소를 확인해주세요.",
  );
  if (
    data.action === "channel" ||
    (data.action === "discovery" && data.extra === "true")
  )
    requireFeature("ingestion");
  const { error } = await c.db.rpc("ops_admin_command", {
    p_action: data.action,
    p_value: data.value,
    p_extra: "extra" in data ? data.extra : "",
  });
  if (error)
    failDatabase(
      error,
      "작업을 저장하지 못했습니다. 권한·대상·요청 한도를 확인해주세요.",
    );
  return NextResponse.json({ ok: true });
});
