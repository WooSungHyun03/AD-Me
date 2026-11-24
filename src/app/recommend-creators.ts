"use server";

import { z } from "zod";
import {
  rank,
  matchingPolicySchema,
  formats,
  type Policy,
} from "@/lib/catalog";
import { context } from "@/lib/api";
import { confirmedProductConditionContext } from "@/lib/product-condition-workflow";
import { publicCreators } from "@/lib/data";
import type { FeaturedChannel } from "@/lib/featured-youtube";
import { readYoutubeDirectory } from "@/lib/youtube-directory";
import { configured, supabase } from "@/lib/supabase";
import { publicTopicOptions } from "@/lib/public-youtube-topics";

const topic = z.custom<keyof typeof publicTopicOptions>(
  (value) =>
    typeof value === "string" && Object.hasOwn(publicTopicOptions, value),
);
const input = z.object({
  product: z.string().trim().min(2).max(120),
  audience: z.string().trim().min(2).max(160),
  category: topic,
  budget: z.coerce.number().int().min(10000).max(100000000),
  preference: z.string().trim().max(120),
  format: z.union([z.literal(""), z.enum(formats as [string, ...string[]])]),
  policy: matchingPolicySchema,
});
export type RecommendationState = {
  error?: string;
  brief?: {
    product: string;
    audience: string;
    category: string;
    budget: number;
    policy: Policy;
    format?: string;
    confirmedSource?: {
      id: string;
      sourceVersion: string;
      promptVersion: string;
    };
  };
  registered?: Array<{
    id: string;
    name: string;
    score: number | null;
    reasons: string[];
    missing: string[];
    coverage: number;
    status: "eligible" | "hold";
  }>;
  channels?: FeaturedChannel[];
  incomplete?: boolean;
};

export async function recommendCreators(
  _previous: RecommendationState,
  form: FormData,
): Promise<RecommendationState> {
  const parsed = input.safeParse({
    product: form.get("product"),
    audience: form.get("audience"),
    category: form.get("category"),
    budget: form.get("budget"),
    preference: form.get("preference"),
    format: form.get("format") ?? "",
    policy: {
      category: form.get("categoryPolicy") ?? "hard",
      budget: form.get("budgetPolicy") ?? "hard",
      unknown: form.get("unknownPolicy") ?? "exclude",
    },
  });
  if (!parsed.success)
    return {
      error:
        "상품과 타깃을 입력하고, 콘텐츠 분야와 1만~1억 원의 예산을 확인해 주세요.",
    };
  const { product, audience, category, budget, preference, format } =
    parsed.data;
  let confirmedSource:
    { id: string; sourceVersion: string; promptVersion: string } | undefined;
  if (
    ["conditionRequestId", "conditionRevision", "conditionSourceVersion"].some(
      (key) => form.has(key),
    )
  ) {
    const reference = z
      .strictObject({
        id: z.uuid(),
        revision: z.coerce.number().int().min(1).max(1),
        sourceVersion: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .safeParse({
        id: form.get("conditionRequestId"),
        revision: form.get("conditionRevision"),
        sourceVersion: form.get("conditionSourceVersion"),
      });
    if (!reference.success)
      return { error: "확인한 상품 조건을 다시 불러와 주세요." };
    try {
      const actor = await context();
      if (!actor || actor.role !== "brand")
        return { error: "본인 브랜드 계정에서 조건을 확인해주세요." };
      confirmedSource = await confirmedProductConditionContext(
        actor.db,
        reference.data,
        parsed.data,
      );
    } catch {
      return {
        error:
          "상품이나 확인한 조건이 변경됐습니다. 다시 확인하거나 수동으로 추천을 실행해주세요.",
      };
    }
  }
  const policy: Policy = {
    category: "hard",
    budget: "hard",
    unknown: "exclude",
    ...parsed.data.policy,
  };
  const [profiles, publicDirectory] = await Promise.all([
    publicCreators().catch(() => null),
    (async () => {
      if (!configured()) return null;
      try {
        return await readYoutubeDirectory(
          await supabase(),
          new URLSearchParams({ "yt-topic": category }),
        );
      } catch {
        return null;
      }
    })(),
  ]);
  if (!profiles && !publicDirectory)
    return { error: "후보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." };
  const categories = category.split("·");
  const tags = [...new Set(preference.split(/[,\s]+/).filter(Boolean))].slice(
    0,
    8,
  );
  const eligible = (profiles ?? []).filter(
    (c) =>
      !c.is_demo && c.is_available === true && c.platforms.includes("youtube"),
  );
  const registered = rank(
    {
      category: "",
      categories,
      vibes: tags,
      format,
      budget_krw: budget,
      platforms: ["youtube"],
      policy,
    },
    eligible,
  )
    .slice(0, 6)
    .map((result) => ({
      id: result.creatorId,
      name: result.creator.name,
      score: result.score,
      coverage: result.coverage,
      status: result.status as "eligible" | "hold",
      reasons: [
        result.creator.categories
          .filter((name) => categories.includes(name))
          .join(" · "),
        result.creator.price_min_krw == null
          ? "견적 미확인"
          : result.creator.price_min_krw.toLocaleString("ko-KR") + "원부터",
        ...result.matchedTags,
        ...result.reasons,
      ],
      missing: [
        ...new Set([
          ...result.missing,
          "오디언스 일치 여부",
          "기간별 평균 조회수",
        ]),
      ],
    }));
  const channels = (publicDirectory?.items ?? [])
    .filter((channel) => !channel.creator_id)
    .slice(0, 6);
  return {
    brief: {
      product,
      audience,
      category,
      budget,
      policy,
      format,
      ...(confirmedSource ? { confirmedSource } : {}),
    },
    registered,
    channels,
    incomplete: !profiles || !publicDirectory,
  };
}
