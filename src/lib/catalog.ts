import creators from "../../fixtures/creators.demo.json";
import campaigns from "../../fixtures/campaigns.demo.json";
export type Creator = Omit<
  (typeof creators)[number],
  "owner_id" | "source_url" | "price_min_krw" | "price_max_krw" | "is_available"
> & {
  price_min_krw: number | null; // null = 견적 미확인
  price_max_krw: number | null;
  is_available: boolean | null; // null = 협업 의사 미확인
  owner_id: string | null;
  source_url: string | null;
  social_url?: string;
  portfolio_url?: string;
  owner_consent?: boolean;
  claim_status?: string;
};
export type Policy = {
  category: "hard" | "soft"; // hard = must match; soft = scored preference
  budget: "hard" | "soft"; // hard = creator minimum quote must fit the budget
  unknown: "exclude" | "hold"; // hard condition with missing creator data
};
export const DEFAULT_POLICY: Policy = {
  category: "soft",
  budget: "soft",
  unknown: "hold",
};
export type Brief = {
  category: string;
  vibes: string[];
  format: string;
  budget_krw: number;
  platforms?: string[];
  policy?: Partial<Policy>;
};
// Initial weights (sum 100). Missing factors are dropped and the rest renormalized.
export const WEIGHTS = {
  vibe: 28,
  category: 25,
  audience: 20,
  budget: 15,
  format: 12,
} as const;
export { creators, campaigns };
export const categories = [...new Set(creators.flatMap((c) => c.categories))];
export const vibes = [...new Set(creators.flatMap((c) => c.vibes))];
export const formats = [
  "숏폼",
  "제품 리뷰",
  "브이로그",
  "언박싱",
  "튜토리얼",
  "PPL",
  "화보",
];
export const platforms = ["instagram", "youtube", "tiktok"] as const;
type Status = "eligible" | "hold" | "excluded";
// Gates run before scoring; an excluded creator is never scored.
function gate(brief: Brief, c: Creator, policy: Policy) {
  const excluded: string[] = [],
    held: string[] = [];
  if (!c.published) excluded.push("비공개 프로필");
  if (c.is_available !== true)
    excluded.push(
      c.is_available === null ? "협업 의사 미확인" : "협업 불가 일정",
    );
  if (
    brief.platforms?.length &&
    !brief.platforms.some((p) => c.platforms.includes(p))
  )
    excluded.push("플랫폼 불일치");
  const unknown = (reason: string) =>
    (policy.unknown === "exclude" ? excluded : held).push(reason);
  if (policy.category === "hard" && brief.category) {
    if (!c.categories.length) unknown("분야 미확인");
    else if (!c.categories.includes(brief.category))
      excluded.push("분야 불일치(필수)");
  }
  if (policy.budget === "hard" && brief.budget_krw > 0) {
    if (c.price_min_krw === null) unknown("견적 미확인");
    else if (c.price_min_krw > brief.budget_krw)
      excluded.push("예산 초과(필수)");
  }
  const status: Status = excluded.length
    ? "excluded"
    : held.length
      ? "hold"
      : "eligible";
  return { status, reasons: [...excluded, ...held] };
}
export function match(brief: Brief, c: Creator) {
  const policy = { ...DEFAULT_POLICY, ...brief.policy };
  const { status, reasons } = gate(brief, c, policy);
  const base = {
    creatorId: c.seed_id,
    eligible: status !== "excluded",
    status,
    reasons,
    policy,
    version: "adme-1.1",
  };
  if (status === "excluded")
    return {
      ...base,
      score: null,
      coverage: 0,
      breakdown: [],
      matchedTags: [],
      missing: [],
    };
  const overlap = brief.vibes.filter((t) => c.vibes.includes(t));
  const breakdown = [
    {
      factor: "이미지·분위기",
      weight: WEIGHTS.vibe,
      value: brief.vibes.length ? overlap.length / brief.vibes.length : null,
      evidence: overlap.join(", ") || "일치 태그 없음",
    },
    {
      factor: "콘텐츠 분야",
      weight: WEIGHTS.category,
      value:
        brief.category && c.categories.length
          ? Number(c.categories.includes(brief.category))
          : null,
      evidence: c.categories.join(", ") || "분야 미확인",
    },
    {
      factor: "타깃 고객",
      weight: WEIGHTS.audience,
      value: null,
      evidence: "오디언스 데이터 미확보",
    },
    {
      factor: "예산",
      weight: WEIGHTS.budget,
      // Unknown quote is missing data, never a free (0원) match; a 0원 quote fits any budget.
      value:
        brief.budget_krw > 0 && c.price_min_krw !== null
          ? c.price_min_krw === 0
            ? 1
            : Math.min(1, brief.budget_krw / c.price_min_krw)
          : null,
      evidence:
        c.price_min_krw === null
          ? "견적 미확인"
          : `최소 견적 ${c.price_min_krw.toLocaleString()}원 (${c.is_demo ? "가상" : "본인 등록"})`,
    },
    {
      factor: "광고 형식",
      weight: WEIGHTS.format,
      value: brief.format ? Number(c.formats.includes(brief.format)) : null,
      evidence: c.formats.join(", "),
    },
  ];
  // coverage = data fidelity: share of total weight backed by known data.
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
    ...base,
    score,
    coverage,
    breakdown,
    matchedTags: overlap,
    missing: breakdown.filter((b) => b.value === null).map((b) => b.factor),
  };
}
// Confirmed candidates first, then held ones; score desc; creatorId for a stable tie order.
export function rank(brief: Brief, list: Creator[] = creators) {
  return list
    .map((c) => ({ creator: c, ...match(brief, c) }))
    .filter((r) => r.status !== "excluded")
    .sort(
      (a, b) =>
        Number(a.status === "hold") - Number(b.status === "hold") ||
        (b.score ?? 0) - (a.score ?? 0) ||
        a.creatorId.localeCompare(b.creatorId),
    );
}

// D032: "similar profiles" — deterministic shared-tag score. Reasons are only the tags both profiles list
// (category, vibe, format, platform); never followers, price, demographics or any inferred attribute.
const SIM_WEIGHTS = {
  categories: 3,
  formats: 2,
  vibes: 1,
  platforms: 1,
} as const;
const SIM_LABELS = {
  categories: "분야",
  formats: "형식",
  vibes: "분위기",
  platforms: "플랫폼",
} as const;
export function similarCreators(target: Creator, list: Creator[], n = 3) {
  return (
    list
      .filter(
        (c) =>
          c.seed_id !== target.seed_id &&
          c.published !== false &&
          c.is_demo === target.is_demo && // fictional and real profiles are never mixed
          c.data_source !== "owner_removed" &&
          c.name !== "삭제된 프로필",
      )
      .map((c) => {
        const reasons: string[] = [];
        let score = 0;
        for (const k of Object.keys(
          SIM_WEIGHTS,
        ) as (keyof typeof SIM_WEIGHTS)[]) {
          const shared = (c[k] as string[]).filter((t) =>
            (target[k] as string[]).includes(t),
          );
          score += shared.length * SIM_WEIGHTS[k];
          reasons.push(...shared.map((t) => `${SIM_LABELS[k]} ${t}`));
        }
        return { creator: c, score, reasons };
      })
      // At least one shared category or vibe: a shared platform alone is not "similar".
      .filter((r) =>
        r.reasons.some((x) => x.startsWith("분야") || x.startsWith("분위기")),
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.creator.seed_id.localeCompare(b.creator.seed_id),
      )
      .slice(0, n)
  );
}
