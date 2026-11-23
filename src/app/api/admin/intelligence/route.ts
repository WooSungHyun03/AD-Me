import { NextResponse } from "next/server";
import { context, fail, safeOrigin } from "@/lib/api";
import { opsCommand } from "@/lib/intelligence";

export async function POST(request: Request) {
  if (!safeOrigin(request)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const result = opsCommand.safeParse(await request.json().catch(() => null));
  if (!result.success) return fail("입력한 값과 채널 주소를 확인해주세요.");
  const data = result.data;
  const { error } = await c.db.rpc("ops_admin_command", {
    p_action: data.action,
    p_value: data.value,
    p_extra: "extra" in data ? data.extra : "",
  });
  if (error?.code === "42501")
    return fail("이 작업에 필요한 권한이 없습니다.", 403);
  if (error?.code === "54000")
    return fail("일일 수동 수집 한도에 도달했습니다.", 429);
  if (error)
    return fail("작업을 저장하지 못했습니다. 대상과 설정을 확인해주세요.", 409);
  return NextResponse.json({ ok: true });
}
