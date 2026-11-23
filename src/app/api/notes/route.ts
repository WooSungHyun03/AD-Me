import { compatibleApiRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
// D040: private note per creator (owner-only table, separate from proposal messages). Empty body deletes it.
 async function handlePUT(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({
      creatorId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
      body: z.string().trim().max(2000),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("메모는 2000자까지 쓸 수 있습니다.");
  const match = { owner_id: c.user.id, creator_id: p.data.creatorId };
  const { error } = p.data.body
    ? await c.db
        .from("creator_notes")
        .upsert({
          ...match,
          body: p.data.body,
          updated_at: new Date().toISOString(),
        })
    : await c.db.from("creator_notes").delete().match(match);
  if (error) return fail("메모를 저장하지 못했습니다.", 400);
  return NextResponse.json({ ok: true });
}

export const PUT=compatibleApiRoute("src/app/api/notes/route.ts.PUT",handlePUT);
