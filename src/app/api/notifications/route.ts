import { compatibleApiRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { context, fail } from "@/lib/api";
import { loadNotifications } from "@/lib/notifications";
 async function handleGET() {
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  try {
    return NextResponse.json(await loadNotifications(c.db), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return fail("알림을 불러오지 못했습니다.", 503);
  }
}

export const GET=compatibleApiRoute("src/app/api/notifications/route.ts.GET",handleGET);
