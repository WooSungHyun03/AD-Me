import { NextResponse } from "next/server";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  requireContext,
} from "@/lib/api";
import { profileSchema } from "@/lib/schemas";
import { z } from "zod";
import { publicationProofSchema } from "@/lib/consent";
export const POST = apiRoute("profile.post", async (req) => {
  const c = await requireContext();
  if (c.role !== "creator") return fail("크리에이터 계정이 필요합니다.", 403);
  const p = await parseBody(
    req,
    z.strictObject({
      profile: profileSchema,
      publication: publicationProofSchema,
    }),
    "프로필 입력 항목을 확인해주세요.",
  );
  const { data, error } = await c.db.rpc("save_publication", {
    p_scope: "creator",
    p_data: p.profile,
    p_version: p.publication.version,
    p_hash: p.publication.documentHash,
    p_key: p.publication.requestKey,
  });
  if (error) failDatabase(error, "프로필을 저장하지 못했습니다.");
  return NextResponse.json(data);
});
export const DELETE = apiRoute("profile.delete", async () => {
  const c = await requireContext();
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
  if (error) failDatabase(error, "프로필을 삭제하지 못했습니다.");
  if (!data) return fail("등록된 프로필이 없습니다.", 404);
  return NextResponse.json({
    ok: true,
    message:
      "공개 프로필은 삭제되었습니다. 협업·결제 기록은 유지되며 프로필을 다시 등록할 수 있습니다.",
  });
});
