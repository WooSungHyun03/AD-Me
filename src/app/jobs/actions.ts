"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { context } from "@/lib/api";
import { campaignSchema } from "@/lib/schemas";

function message(error: { message: string; code: string }) {
  if (error.message === "MARKETPLACE_CREDIT_REQUIRED")
    return "사용 가능한 이용권이 없습니다.";
  if (error.code === "PT429") return "요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.";
  if (error.code === "42501")
    return "이 작업의 권한 또는 YouTube 소유권 인증을 확인해주세요.";
  return "지금은 요청을 완료할 수 없습니다. 캠페인 상태 및 입력 내용을 확인해주세요.";
}

export async function saveProduct(_: string, form: FormData) {
  const session = await context();
  if (session?.role !== "brand") return "브랜드 계정으로 로그인해주세요.";
  const input = z
    .object({
      name: z.string().trim().min(2).max(100),
      description: z.string().trim().min(5).max(1200),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return "상품 이름과 설명을 확인해주세요.";
  const { error } = await session.db.from("brand_products").insert(input.data);
  if (error) return message(error);
  revalidatePath("/brand/products");
  return "상품을 등록했습니다.";
}

export async function saveJob(_: string, form: FormData) {
  const session = await context();
  if (session?.role !== "brand") return "브랜드 계정으로 로그인해주세요.";
  const product = z.uuid().safeParse(form.get("productId"));
  const brief = campaignSchema.safeParse({
    ...Object.fromEntries(form),
    product: "등록 상품",
    status: "draft",
    platforms: ["youtube"],
    vibes: String(form.get("vibes") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    budget_krw: Number(form.get("budget_krw")),
  });
  if (!product.success || !brief.success)
    return "필수 항목, 분야, 광고 형식, 예산을 확인해주세요.";
  const { error, data } = await session.db.rpc("marketplace_create", {
    p_product: product.data,
    p_brief: brief.data,
  });
  if (error || !data)
    return error ? message(error) : "캠페인 초안을 저장하지 못했습니다.";
  revalidatePath("/jobs");
  redirect("/jobs/" + data);
}

export async function jobAction(_: string, form: FormData) {
  const session = await context();
  if (!session) return "로그인해주세요.";
  const data = z
    .object({
      action: z.enum(["publish", "close", "apply"]),
      job: z.uuid(),
      pitch: z.string().trim().max(2000).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!data.success) return "입력 항목을 확인해주세요.";
  const { error } = await session.db.rpc("marketplace_action", {
    p_action: data.data.action,
    p_campaign: data.data.job,
    p_pitch: data.data.pitch ?? "",
  });
  if (error) return message(error);
  revalidatePath("/jobs");
  revalidatePath("/jobs/" + data.data.job);
  if (data.data.action !== "close")
    redirect(`/jobs/${data.data.job}?completed=${data.data.action}`);
  return "캠페인을 마감했습니다.";
}

export type SearchState = {
  message?: string;
  candidates?: { id: string; reason: string }[];
};
export async function searchCreators(
  _: SearchState,
  form: FormData,
): Promise<SearchState> {
  const session = await context();
  if (session?.role !== "brand")
    return { message: "브랜드 계정으로 로그인해주세요." };
  const params = z
    .object({
      query: z.string().trim().max(120),
      min: z.coerce.number().int().min(0).max(10_000_000_000),
      max: z.coerce.number().int().min(0).max(10_000_000_000),
      days: z.enum(["0", "30", "90"]),
      budget: z.coerce.number().int().min(0).max(100_000_000),
    })
    .safeParse(Object.fromEntries(form));
  if (!params.success || params.data.min > params.data.max)
    return { message: "검색 범위를 확인해주세요." };
  const p = params.data;
  const { error, data } = await session.db.rpc("marketplace_search", {
    p_query: p.query,
    p_min: p.min,
    p_max: p.max,
    p_days: Number(p.days),
    p_budget: p.budget,
  });
  if (error) return { message: message(error) };
  const candidates = z
    .array(z.object({ id: z.string(), reason: z.string() }))
    .safeParse(data);
  if (!candidates.success)
    return { message: "검색 결과에 연결하지 못했습니다." };
  return {
    candidates: candidates.data,
    message: candidates.data.length
      ? "추천 후보를 찾았습니다."
      : "조건에 맞는 공개 채널이 없습니다. 이용권은 차감되지 않았습니다.",
  };
}
