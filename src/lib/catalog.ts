import creators from "../../fixtures/creators.demo.json";
import campaigns from "../../fixtures/campaigns.demo.json";
import { matchingFactors } from "./service-catalog";
export type Creator = Omit<
  (typeof creators)[number],
  "owner_id" | "source_url"
> & {
  owner_id: string | null;
  source_url: string | null;
  social_url?: string;
  portfolio_url?: string;
  owner_consent?: boolean;
};
export type Brief = {
  category: string;
  vibes: string[];
  format: string;
  budget_krw: number;
  platforms?: string[];
};
export { creators, campaigns };
export const categories = [...new Set(creators.flatMap((c) => c.categories))];
export const vibes = [...new Set(creators.flatMap((c) => c.vibes))];
export type MatchingCreator = Pick<
  Creator,
  | "seed_id"
  | "published"
  | "is_available"
  | "platforms"
  | "vibes"
  | "categories"
  | "price_min_krw"
  | "is_demo"
  | "formats"
>;
export function match(brief: Brief, c: MatchingCreator) {
  const eligible =
    c.published &&
    c.is_available &&
    (!brief.platforms?.length ||
      brief.platforms.some((p) => c.platforms.includes(p)));
  const overlap = brief.vibes.filter((t) => c.vibes.includes(t));
  const breakdown = [
    {
      ...matchingFactors.tone,
      value: brief.vibes.length ? overlap.length / brief.vibes.length : null,
      evidence: overlap.join(", ") || "일치 태그 없음",
    },
    {
      ...matchingFactors.category,
      value: brief.category
        ? Number(c.categories.includes(brief.category))
        : null,
      evidence: c.categories.join(", "),
    },
    {
      ...matchingFactors.audience,
      value: null,
      evidence: "오디언스 데이터 미확보",
    },
    {
      ...matchingFactors.budget,
      value:
        brief.budget_krw > 0
          ? Math.min(1, brief.budget_krw / c.price_min_krw)
          : null,
      evidence: `최소 견적 ${c.price_min_krw.toLocaleString()}원 (${c.is_demo ? "가상" : "본인 등록"})`,
    },
    {
      ...matchingFactors.format,
      value: brief.format ? Number(c.formats.includes(brief.format)) : null,
      evidence: c.formats.join(", "),
    },
  ];
  const coverage = breakdown.reduce(
    (n, b) => n + (b.value === null ? 0 : b.weight),
    0,
  );
  const score = coverage
    ? Math.round(
        (breakdown.reduce((n, b) => n + (b.value ?? 0) * b.weight, 0) /
          coverage) *
          100,
      )
    : 0;
  return {
    creatorId: c.seed_id,
    eligible,
    score,
    coverage,
    breakdown,
    matchedTags: overlap,
    version: "adme-1.0",
    missing: breakdown.filter((b) => b.value === null).map((b) => b.factor),
  };
}
type Ranked<T extends MatchingCreator> = ReturnType<typeof match> & {
  creator: T;
};
export function rank(brief: Brief): Ranked<Creator>[];
export function rank<T extends MatchingCreator>(
  brief: Brief,
  list: readonly T[],
): Ranked<T>[];
export function rank(
  brief: Brief,
  list: readonly MatchingCreator[] = creators,
) {
  return list
    .map((c) => ({ creator: c, ...match(brief, c) }))
    .filter((r) => r.eligible)
    .sort(
      (a, b) => b.score - a.score || a.creatorId.localeCompare(b.creatorId),
    );
}
