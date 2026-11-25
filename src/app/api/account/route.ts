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
import { publicationProofSchema } from "@/lib/consent";
import { categories } from "@/lib/catalog";
export const PATCH = apiRoute("account.patch", async (req) => {
  const c = await requireContext();
  const p = await parseBody(
    req,
    z
      .object({
        name: z.string().trim().min(2).max(80),
        analytics_opt_out: z.boolean().optional(),
        brand: brandAccountSchema.optional(),
        publication: publicationProofSchema.optional(),
      })
      .strict(),
    "이름은 2~80자여야 합니다.",
  );
  if (p.brand) {
    if (c.role !== "brand")
      fail("브랜드 계정만 브랜드 정보를 수정할 수 있습니다.", 403);
    if (!p.publication)
      fail("공개 선택의 정책 버전과 요청 정보를 확인해주세요.", 422);
    const { data, error } = await c.db.rpc("save_publication", {
      p_scope: "brand",
      p_data: { name: p.name, ...p.brand },
      p_version: p.publication.version,
      p_hash: p.publication.documentHash,
      p_key: p.publication.requestKey,
    });
    if (error) failDatabase(error, "브랜드 정보를 저장하지 못했습니다.");
    return NextResponse.json(data);
  }
  const { error } = await c.db
    .from("profiles")
    .update({ name: p.name, analytics_opt_out: p.analytics_opt_out })
    .eq("id", c.user.id);
  if (error) failDatabase(error, "계정 설정을 저장하지 못했습니다.");
  return NextResponse.json({ ok: true });
});

export const PUT = apiRoute("account.preferences", async (req) => {
  const c = await requireContext();
  const preferences = await parseBody(
    req,
    z.strictObject({
      service_email: z.boolean(),
      marketing_email: z.boolean(),
      interests: z.array(z.enum(categories)).max(5),
    }),
    "알림과 관심 분야 설정을 확인해주세요.",
  );
  const { error } = await c.db.rpc("set_preferences", {
    p_service: preferences.service_email,
    p_marketing: preferences.marketing_email,
    p_interests: [...new Set(preferences.interests)],
  });
  if (error) failDatabase(error, "알림 설정을 저장하지 못했습니다.");
  return NextResponse.json({ ok: true });
});
