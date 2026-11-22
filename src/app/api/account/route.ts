import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
import { categories } from "@/lib/catalog";
export async function PATCH(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({
      name: z.string().trim().min(2).max(80),
      analytics_opt_out: z.boolean().optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("이름은 2~80자여야 합니다.");
  const { error } = await c.db
    .from("profiles")
    .update(p.data)
    .eq("id", c.user.id);
  if (error) return fail("이름을 저장하지 못했습니다.");
  return NextResponse.json({ ok: true });
}
// D015: notification / marketing consent / interests. Version and time are recorded by the database.
export async function PUT(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({
      service_email: z.boolean(),
      marketing_email: z.boolean(),
      interests: z.array(z.enum(categories as [string, ...string[]])).max(5),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("설정 값이 올바르지 않습니다.");
  const { error } = await c.db.rpc("set_preferences", {
    p_service: p.data.service_email,
    p_marketing: p.data.marketing_email,
    p_interests: [...new Set(p.data.interests)],
  });
  if (error) return fail("설정을 저장하지 못했습니다.");
  return NextResponse.json({ ok: true });
}
