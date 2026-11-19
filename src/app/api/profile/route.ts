import { NextResponse } from "next/server";
import { context, fail, safeOrigin } from "@/lib/api";
import { profileSchema } from "@/lib/schemas";
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  if (c.role !== "creator") return fail("크리에이터 계정이 필요합니다.", 403);
  const p = profileSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("프로필 입력 항목을 확인해주세요.");
  const id = `user-${c.user.id}`;
  const profile = {
    ...p.data,
    seed_id: id,
    handle: "self_reported",
    followers: 0,
    metrics_source: "unavailable",
    is_demo: false,
    data_source: "owner_registration",
    source_url: null,
    portrait_asset: null,
    image_placeholder: "initials",
    owner_id: c.user.id,
  };
  const { error } = await c.db
    .from("creators")
    .upsert(
      { id, owner_id: c.user.id, published: p.data.published, profile },
      { onConflict: "id" },
    );
  if (error) return fail("프로필을 저장하지 못했습니다.", 500);
  return NextResponse.json({ id });
}
export async function DELETE(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const { error } = await c.db
    .from("creators")
    .delete()
    .eq("owner_id", c.user.id);
  if (error)
    return fail(
      "진행 중인 협업이 있어 삭제할 수 없습니다. 비공개 설정을 이용해주세요.",
    );
  return NextResponse.json({ ok: true });
}
