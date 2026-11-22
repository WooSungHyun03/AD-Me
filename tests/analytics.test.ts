import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  conversion,
  EVENTS,
  FUNNEL,
  EVENT_RETENTION_DAYS,
} from "@/lib/analytics";

describe("product event contract", () => {
  const sql = readFileSync(
    "supabase/migrations/202611190017_product_events.sql",
    "utf8",
  );
  it("matches the database check constraint and retention", () => {
    expect(sql).toContain(
      `event in (${FUNNEL.map((e) => `'${e}'`).join(",")})`,
    );
    expect(sql).toContain(`interval '${EVENT_RETENTION_DAYS} days'`);
    expect(Object.keys(EVENTS)).toEqual([...FUNNEL]);
  });
  it("computes step conversion without dividing by zero", () => {
    const r = conversion({
      signup: 10,
      explore: 5,
      shortlist: 0,
      proposal: 0,
      accept: 0,
    });
    expect(r.map((x) => x.rate)).toEqual([null, 50, 0, null, null]);
  });
});
