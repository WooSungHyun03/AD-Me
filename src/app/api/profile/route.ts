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
    source_url: p.data.social_url || null,
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
  if (c.role !== "creator") return fail("크리에이터 계정이 필요합니다.", 403);
  const redacted = {
    seed_id: `user-${c.user.id}`,
    name: "삭제된 크리에이터",
    handle: "deleted",
    bio: "",
    categories: [],
    vibes: [],
    formats: [],
    platforms: [],
    price_min_krw: 0,
    price_max_krw: 0,
    followers: 0,
    is_available: false,
    published: false,
    is_demo: false,
    metrics_source: "unavailable",
    data_source: "owner_removed",
    owner_id: c.user.id,
    source_url: null,
    portrait_asset: null,
    image_placeholder: "initials",
  };
  const { data, error } = await c.db
    .from("creators")
    .update({ published: false, profile: redacted })
    .eq("owner_id", c.user.id)
    .select("id")
    .maybeSingle();
  if (error) return fail("프로필을 삭제하지 못했습니다.", 500);
  if (!data) return fail("등록된 프로필이 없습니다.", 404);
  return NextResponse.json({
    ok: true,
    message:
      "공개 프로필은 삭제되었습니다. 협업·결제 기록은 유지되며 프로필을 다시 등록할 수 있습니다.",
  });
}
