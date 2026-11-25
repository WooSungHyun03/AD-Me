import { compatibleApiRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, failDatabase, safeOrigin } from "@/lib/api";
// D036: creatorId is the public catalog reference shown to the browser. The DB gateway resolves it,
// applies the catalog visibility gate and confines the change to the caller's own list.
const item = z.object({
  listId: z.uuid(),
  creatorId: z.string().trim().min(1).max(100),
});
const missing = "그룹이나 크리에이터를 찾을 수 없습니다.";
async function parse(req: Request) {
  if (!safeOrigin(req)) return { err: fail("허용되지 않은 요청입니다.", 403) };
  const c = await context();
  if (!c) return { err: fail("로그인이 필요합니다.", 401) };
  const p = item.safeParse(await req.json().catch(() => null));
  if (!p.success) return { err: fail("잘못된 요청입니다.") };
  return { c, d: p.data };
}
async function handlePOST(req: Request) {
  const { c, d, err } = await parse(req);
  if (!c) return err;
  const { data, error } = await c.db.rpc("add_saved_list_item", {
    p_list: d.listId,
    p_ref: d.creatorId,
  });
  // Foreign list, unknown or hidden creator are one indistinguishable "not found".
  if (error?.code === "42501") return fail(missing, 404);
  if (error) failDatabase(error, "그룹에 추가하지 못했습니다.");
  if (data === "exists")
    return fail("이미 이 그룹에 있는 크리에이터입니다.", 409);
  return NextResponse.json({ ok: true }, { status: 201 });
}
async function handleDELETE(req: Request) {
  const { c, d, err } = await parse(req);
  if (!c) return err;
  const { data, error } = await c.db.rpc("remove_saved_list_item", {
    p_list: d.listId,
    p_ref: d.creatorId,
  });
  if (error?.code === "42501") return fail(missing, 404);
  if (error) failDatabase(error, "그룹에서 빼지 못했습니다.");
  if (data !== true) return fail("삭제할 항목이 없습니다.", 404);
  return NextResponse.json({ ok: true });
}

export const POST = compatibleApiRoute(
  "src/app/api/lists/items/route.ts.POST",
  handlePOST,
);
export const DELETE = compatibleApiRoute(
  "src/app/api/lists/items/route.ts.DELETE",
  handleDELETE,
);
