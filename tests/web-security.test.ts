// D077: CSP stays minimal, server-side fetches only reach fixed hosts (no SSRF / DNS-rebinding surface),
// and state-changing API calls refuse cross-site origins (CSRF).
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { csp } from "../next.config";
import { safeOrigin } from "../src/lib/api";
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
describe("D077 web boundary", () => {
  it("CSP: no eval, no plugins, no framing, only self + Toss + Supabase", () => {
    const d = Object.fromEntries(
      csp.split("; ").map((x) => [x.split(" ")[0], x.split(" ").slice(1)]),
    );
    expect(d["default-src"]).toEqual(["'self'"]);
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
    expect(d["script-src"]).not.toContain("'unsafe-eval'");
    const external = Object.values(d)
      .flat()
      .filter((s) => /^(https?|wss?):/.test(s));
    for (const s of external)
      expect(s).toMatch(
        /^(https:\/\/\*\.tosspayments\.com|(http|ws)s?:\/\/(127\.0\.0\.1|localhost):\d+|(https|wss):\/\/[a-z0-9]+\.supabase\.co)$/,
      );
    expect(Object.values(d).flat()).not.toContain("*");
    expect(Object.values(d).flat()).not.toContain("https:");
  });
  it("server code fetches only fixed hosts", () => {
    const server = [
      ...files("src/app/api"),
      ...files("src/lib"),
      ...files("src/app").filter((f) => /actions\.ts$/.test(f)),
    ];
    const calls = server.flatMap((f) =>
      [
        ...readFileSync(f, "utf8").matchAll(/\b(?:fetch|f)\(\s*([^,)\n]+)/g),
      ].map((m) => [f, m[1].trim()]),
    );
    expect(calls.length).toBeGreaterThan(0);
    for (const [f, arg] of calls)
      expect(`${f}: ${arg}`).toMatch(
        /: (process\.env\.NEXT_PUBLIC_SUPABASE_URL \+ "\/functions\/v1\/[a-z-]+"|url)$/,
      );
    // The only dynamic `url` is the YouTube client, built on a constant API origin.
    expect(readFileSync("src/lib/ingestion/youtube.ts", "utf8")).toMatch(
      /const API = "https:\/\/www\.googleapis\.com\/youtube\/v3";[\s\S]*new URL\(`\$\{API\}\//,
    );
  });
  it("CSRF: cross-site or malformed origins are refused", () => {
    const req = (h: Record<string, string>) =>
      new Request("https://adme.test/api/x", {
        method: "POST",
        headers: { host: "adme.test", ...h },
      });
    expect(safeOrigin(req({ origin: "https://adme.test" }))).toBe(true);
    expect(safeOrigin(req({ origin: "https://evil.test" }))).toBe(false);
    expect(safeOrigin(req({ origin: "https://adme.test.evil.test" }))).toBe(
      false,
    );
    expect(safeOrigin(req({ origin: "null" }))).toBe(false);
    expect(safeOrigin(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(safeOrigin(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });
});
