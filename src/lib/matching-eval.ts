// D046: feedback contract and offline evaluation. Feedback measures what raters said about what they were
// shown; it is NOT proof that the model is good. Results below the data minimum are reported as insufficient.
export const SHOWN = 6; // recommendations rendered per campaign (rating is accepted only for these)
export const REASONS = {
  fit: {
    category_match: "분야가 맞음",
    vibe_match: "분위기가 맞음",
    budget_fit: "예산이 맞음",
    format_fit: "형식이 맞음",
    other_fit: "기타 적합",
  },
  unfit: {
    category_mismatch: "분야가 다름",
    vibe_mismatch: "분위기가 다름",
    budget_mismatch: "예산이 맞지 않음",
    unavailable: "협업 어려움",
    brand_safety: "브랜드 안전성 우려",
    other_unfit: "기타 부적합",
  },
} as const;
export type Verdict = keyof typeof REASONS;
export const MIN_DATA = { labels: 30, campaigns: 10 } as const;

export type FeedbackRow = {
  campaign_key: string;
  model_version: string;
  rank_position: number;
  verdict: Verdict;
  accepted: boolean;
  size_bucket: "small" | "mid" | "large" | "unknown";
  split: "train" | "test";
};
const rate = (num: number, den: number) =>
  den ? Math.round((num / den) * 1000) / 10 : null;

/** Offline evaluation on one split (default: test) for one scorer version. */
export function evaluate(
  rows: FeedbackRow[],
  version: string,
  k = 3,
  split: "train" | "test" = "test",
) {
  const r = rows.filter(
    (x) => x.model_version === version && x.split === split,
  );
  const top = r.filter((x) => x.rank_position <= k);
  const campaigns = new Set(r.map((x) => x.campaign_key)).size;
  const sufficient =
    r.length >= MIN_DATA.labels && campaigns >= MIN_DATA.campaigns;
  const bySize = (["small", "mid", "large", "unknown"] as const).map((b) => {
    const g = r.filter((x) => x.size_bucket === b);
    return {
      bucket: b,
      n: g.length,
      fit_rate: rate(g.filter((x) => x.verdict === "fit").length, g.length),
    };
  });
  const known = bySize.filter((b) => b.bucket !== "unknown" && b.n > 0);
  const rates = known.map((b) => b.fit_rate ?? 0);
  return {
    version,
    split,
    labels: r.length,
    campaigns,
    sufficient,
    precision_at_k: rate(
      top.filter((x) => x.verdict === "fit").length,
      top.length,
    ),
    accept_rate_at_k: rate(top.filter((x) => x.accepted).length, top.length),
    by_size: bySize,
    // Flag a gap of 20+ points between follower-size groups that each have at least 10 labels.
    size_bias_flag:
      known.filter((b) => b.n >= 10).length >= 2 &&
      Math.max(...rates) - Math.min(...rates) >= 20,
    statement: sufficient
      ? "평가자 피드백 기준 오프라인 지표입니다. 실제 캠페인 성과나 모델 우수성을 증명하지 않습니다."
      : `데이터 부족(라벨 ${r.length}/${MIN_DATA.labels}, 캠페인 ${campaigns}/${MIN_DATA.campaigns}) — 성능 주장 불가`,
  };
}

/** Regression check between two scorer versions on the same held-out split. */
export function compareVersions(
  rows: FeedbackRow[],
  base: string,
  next: string,
  k = 3,
) {
  const a = evaluate(rows, base, k),
    b = evaluate(rows, next, k);
  const comparable = a.sufficient && b.sufficient;
  return {
    base: a,
    next: b,
    comparable,
    regression:
      comparable && (b.precision_at_k ?? 0) < (a.precision_at_k ?? 0) - 5,
  };
}
