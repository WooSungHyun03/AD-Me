import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  inStage,
  pipelineCsv,
  STAGES,
  stageOf,
  summarize,
  type Stage,
} from "@/lib/pipeline";
import { parseCsv } from "@/lib/csv";

const p = (id: string, status: string, o = {}) => ({
  id,
  status,
  kind: "proposal",
  brand_id: "me",
  campaign_id: "c1",
  created_at: "2026-11-20T01:00:00Z",
  ...o,
});

describe("collaboration pipeline (D056)", () => {
  it("every database status belongs to exactly one stage", () => {
    const sql = readFileSync(
      "supabase/migrations/202611190009_proposal_events.sql",
      "utf8",
    );
    const statuses = sql.match(/status in \(([^)]*)\)/)![1].match(/[a-z_]+/g)!;
    for (const s of statuses)
      expect(
        (Object.keys(STAGES) as Stage[]).filter((k) =>
          (STAGES[k].statuses as readonly string[]).includes(s),
        ),
      ).toHaveLength(1);
    expect(stageOf("pending")).toBe("active");
    expect(stageOf("revision_requested")).toBe("progress");
  });
  it("counts equal the filtered list for every stage", () => {
    const rows = [
      "pending",
      "pending",
      "accepted",
      "submitted",
      "completed",
      "rejected",
      "revision_requested",
    ].map((s, i) => p(String(i), s));
    const c = summarize(rows);
    for (const k of Object.keys(STAGES) as Stage[])
      expect(c[k]).toBe(inStage(rows, k).length);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(rows.length);
    expect(c).toMatchObject({
      active: 2,
      progress: 2,
      review: 1,
      completed: 1,
      closed: 1,
    });
  });
  it("CSV uses recorded dates only, escapes formulas, no estimated metrics", () => {
    const csv = pipelineCsv(
      [
        p("a", "completed"),
        p("b", "pending", { brand_id: "other", kind: "application" }),
      ],
      "me",
      new Map([["c1", '=HYPERLINK("http://evil")']]),
      [
        {
          proposal_id: "a",
          to_status: "accepted",
          created_at: "2026-11-20T16:00:00Z",
        },
        {
          proposal_id: "a",
          to_status: "submitted",
          created_at: "2026-11-21T02:00:00Z",
        },
        {
          proposal_id: "a",
          to_status: "submitted",
          created_at: "2026-11-22T02:00:00Z",
        },
        {
          proposal_id: "a",
          to_status: "completed",
          created_at: "2026-11-22T03:00:00Z",
        },
      ],
      new Map([["a", 2]]),
    );
    const [head, a, b] = parseCsv(csv);
    expect(head.join()).not.toMatch(/전환|매출|노출|ROI|조회/);
    expect(a).toEqual([
      "a",
      "제안",
      "브랜드",
      `'=HYPERLINK("http://evil")`,
      "완료",
      "완료",
      "2026-11-20",
      "2026-11-21",
      "2026-11-21",
      "2026-11-22",
      "2",
    ]);
    expect(b.slice(1, 3)).toEqual(["지원", "크리에이터"]);
    expect(b.slice(7, 10)).toEqual(["", "", ""]);
  });
});
