import { z } from "zod";
import { apiRoute, fail, parseInput } from "@/lib/api";
import { supabase, configured } from "@/lib/supabase";
import { serverAdmin } from "@/lib/server-admin";
export const GET = apiRoute("brands.logo", async (req) => {
  const id = parseInput(
    z.uuid(),
    new URL(req.url).pathname.split("/").at(-2),
    "브랜드를 확인해주세요.",
  );
  if (!configured()) fail("브랜드를 찾을 수 없습니다.", 404);
  const db = await supabase(),
    visible = await db
      .from("brand_profiles")
      .select("id,published")
      .eq("id", id)
      .eq("published", true)
      .maybeSingle();
  if (visible.error || !visible.data) fail("브랜드를 찾을 수 없습니다.", 404);
  const admin = serverAdmin();
  if (!admin) fail("로고 연결을 준비 중입니다.", 503);
  const r = await admin.rpc("image_brand_logo", { p_brand: id });
  const f = z
    .strictObject({
      id: z.uuid(),
      path: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.png$/),
      name: z.string().max(120),
    })
    .safeParse(r.data);
  if (r.error || !f.success) fail("로고를 찾을 수 없습니다.", 404);
  const file = await admin.storage
    .from("adme-private-images")
    .download(f.data.path);
  if (file.error || !file.data) fail("로고를 불러오지 못했습니다.", 503);
  // Re-check publication after storage I/O; responses remain uncacheable.
  const current = await db
    .from("brand_profiles")
    .select("id")
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();
  if (!current.data) fail("브랜드를 찾을 수 없습니다.", 404);
  const latest = await admin.rpc("image_brand_logo", { p_brand: id });
  if (latest.error || latest.data?.id !== f.data.id)
    fail("로고를 찾을 수 없습니다.", 404);
  return new Response(await file.data.arrayBuffer(), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});
