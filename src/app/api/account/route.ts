import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  requireContext,
} from "@/lib/api";
import { brandAccountSchema } from "@/lib/brand-profile";
export const PATCH = apiRoute("account.patch", async (req) => {
  const c = await requireContext();
  const p = await parseBody(
    req,
    z
      .object({
        name: z.string().trim().min(2).max(80),
        brand: brandAccountSchema.optional(),
      })
      .strict(),
    "이름은 2~80자여야 합니다.",
  );
  if (p.brand) {
    if (c.role !== "brand")
      fail("브랜드 계정만 브랜드 정보를 수정할 수 있습니다.", 403);
    const b = p.brand;
    const { data, error } = await c.db.rpc("save_brand_account", {
      p_name: p.name,
      p_brand_name: b.brandName,
      p_industry: b.industry,
      p_introduction: b.introduction,
      p_published: b.published,
      p_contact_name: b.contactName,
      p_contact_email: b.contactEmail,
      p_contact_visibility: b.contactVisibility,
    });
    if (error) failDatabase(error, "브랜드 정보를 저장하지 못했습니다.");
    return NextResponse.json({ ok: true, brandId: data });
  }
  const { error } = await c.db
    .from("profiles")
    .update({ name: p.name })
    .eq("id", c.user.id);
  if (error) failDatabase(error, "이름을 저장하지 못했습니다.");
  return NextResponse.json({ ok: true });
});
