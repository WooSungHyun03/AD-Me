import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

// D085: the hosted verification SQL is generated from the repository and must stay read-only.
const gen = (after: string) =>
  execFileSync(process.execPath, ["scripts/release-verify-sql.mjs", after], {
    encoding: "utf8",
  });

describe("release verification SQL (D085)", () => {
  const after = "20261123100029";
  const sql = gen(after);
  const pending = readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql") && f.split("_")[0] > after)
    .map((f) => f.split("_")[0]);

  it("covers every pending migration in the ledger and object checks", () => {
    expect(pending.length).toBeGreaterThan(0);
    for (const v of pending) {
      expect(sql).toContain(`'${v}'`);
      expect(sql.includes(`\n  ('${v}', `)).toBe(true);
    }
  });

  it("contains only SELECT statements", () => {
    const statements = sql
      .split("\n")
      .filter((l) => !l.startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(4);
    for (const s of statements) expect(s).toMatch(/^select\b/i);
    expect(sql).not.toMatch(
      /^\s*(insert|update|delete|drop|alter|create|grant|revoke|truncate)\b/im,
    );
  });

  it("refuses a malformed version", () => {
    expect(() => gen("latest")).toThrow();
  });
});
