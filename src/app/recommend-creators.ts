"use server";

import { z } from "zod";
import { rank, matchingPolicySchema, type Policy } from "@/lib/catalog";
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
  const { product, audience, category, budget, preference } = parsed.data;
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
      format: "",
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
    brief: { product, audience, category, budget, policy },
    registered,
    channels,
    incomplete: !profiles || !publicDirectory,
  };
}
