import { describe, expect, it } from "vitest";
import {
  compareVersions,
  evaluate,
  MIN_DATA,
  REASONS,
  type FeedbackRow,
} from "@/lib/matching-eval";

const row = (i: number, o: Partial<FeedbackRow> = {}): FeedbackRow => ({
  campaign_key: `c${i % 12}`,
  model_version: "adme-1.1",
  rank_position: (i % 6) + 1,
  verdict: i % 3 ? "fit" : "unfit",
  accepted: i % 4 === 0,
  size_bucket: (["small", "mid", "large"] as const)[i % 3],
  split: "test",
  ...o,
});

describe("matching feedback evaluation (D046)", () => {
  it("refuses to claim performance on sparse data", () => {
    const r = evaluate([row(1), row(2)], "adme-1.1");
    expect(r.sufficient).toBe(false);
    expect(r.statement).toMatch(/데이터 부족.*성능 주장 불가/);
  });
  it("uses only the held-out split and the requested version", () => {
    const rows = Array.from({ length: 40 }, (_, i) => row(i)).concat(
      Array.from({ length: 40 }, (_, i) =>
        row(i, { split: "train", verdict: "fit" }),
      ),
      Array.from({ length: 40 }, (_, i) =>
        row(i, { model_version: "adme-0.9", verdict: "unfit" }),
      ),
    );
    const r = evaluate(rows, "adme-1.1");
    expect(r.labels).toBe(40);
    expect(r.sufficient).toBe(true);
    expect(r.statement).toMatch(/증명하지 않습니다/);
    const top = rows.filter(
      (x) =>
        x.split === "test" &&
        x.model_version === "adme-1.1" &&
        x.rank_position <= 3,
    );
    expect(r.precision_at_k).toBe(
      Math.round(
        (top.filter((x) => x.verdict === "fit").length / top.length) * 1000,
      ) / 10,
    );
  });
  it("flags a large fit-rate gap between follower-size groups", () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      row(i, {
        size_bucket: i < 30 ? "small" : "large",
        verdict: i < 30 ? "unfit" : "fit",
      }),
    );
    expect(evaluate(rows, "adme-1.1").size_bias_flag).toBe(true);
    expect(
      evaluate(
        rows.map((x) => ({ ...x, verdict: "fit" as const })),
        "adme-1.1",
      ).size_bias_flag,
    ).toBe(false);
  });
  it("regression compare needs enough data on both versions", () => {
    const base = Array.from({ length: MIN_DATA.labels }, (_, i) =>
      row(i, { verdict: "fit" }),
    );
    const worse = base.map((x) => ({
      ...x,
      model_version: "adme-1.2",
      verdict: "unfit" as const,
    }));
    expect(
      compareVersions([...base, ...worse], "adme-1.1", "adme-1.2").regression,
    ).toBe(true);
    expect(
      compareVersions(base.slice(0, 3), "adme-1.1", "adme-1.2").comparable,
    ).toBe(false);
  });
  it("reason codes mirror the database check", async () => {
    const sql = (await import("node:fs")).readFileSync(
      "supabase/migrations/20261123100020_matching_feedback.sql",
      "utf8",
    );
    for (const v of ["fit", "unfit"] as const)
      for (const k of Object.keys(REASONS[v])) expect(sql).toContain(`'${k}'`);
  });
});
