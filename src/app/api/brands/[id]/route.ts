import { z } from "zod";
import { apiRoute, fail, failDatabase, parseInput } from "@/lib/api";
import { configured, supabase } from "@/lib/supabase";
import { publicBrandDTO } from "@/lib/brand-profile";

export const GET = apiRoute("brands.get", async (request) => {
  const id = parseInput(
    z.uuid(),
    new URL(request.url).pathname.split("/").pop(),
    "브랜드 ID를 확인해주세요.",
  );
  if (!configured()) fail("브랜드 연결을 준비 중입니다.", 503);
  const db = await supabase();
  const { data, error } = await db
    .from("brand_profiles")
    .select("id,brand_name,industry,introduction,published")
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();
  if (error) failDatabase(error, "브랜드 정보를 불러오지 못했습니다.");
  if (!data) fail("브랜드를 찾을 수 없습니다.", 404);
  const logo = await db.rpc("brand_logo_available", { p_brand: id });
  return Response.json(
    publicBrandDTO({
      ...data,
      logoAvailable: !logo.error && logo.data === true,
    }),
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
});
