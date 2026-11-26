import { describe, expect, it } from "vitest";
import {
  SMOKE_CHECKS,
  summarize,
  type SmokeResponse,
} from "@/lib/release-smoke";

const check = (id: string) => SMOKE_CHECKS.find((c) => c.id === id)!;
const res = (over: Partial<SmokeResponse> = {}): SmokeResponse => ({
  status: 200,
  headers: {},
  body: "",
  ...over,
});

describe("D088 anonymous release smoke", () => {
  it("health must expose only the status", () => {
    const h = check("health");
    const ok = { "cache-control": "private, no-store" };
    expect(h.judge(res({ headers: ok, body: '{"status":"ok"}' }), true)).toBe(
      true,
    );
    expect(
      h.judge(
        res({ headers: ok, body: '{"status":"ok","stats":{"migration":"1"}}' }),
        true,
      ),
    ).toBe(false);
    expect(h.judge(res({ body: '{"status":"ok"}' }), true)).toBe(false);
  });

  it("public pages fail when a secret marker reaches the browser", () => {
    const home = check("public:/");
    expect(home.judge(res({ body: "<html>AD Me</html>" }), true)).toBe(true);
    expect(home.judge(res({ body: "role: service_role" }), true)).toBe(false);
    expect(home.judge(res({ body: "key=sb_secret_abc" }), true)).toBe(false);
    expect(home.judge(res({ status: 500 }), true)).toBe(false);
  });

  it("requires HSTS only on https", () => {
    const s = check("security-headers");
    const base = {
      "content-security-policy": "default-src 'self'",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
    };
    expect(s.judge(res({ headers: base }), false)).toBe(true);
    expect(s.judge(res({ headers: base }), true)).toBe(false);
    expect(
      s.judge(
        res({
          headers: { ...base, "strict-transport-security": "max-age=63072000" },
        }),
        true,
      ),
    ).toBe(true);
  });

  it("gated pages accept a real or streamed redirect to /login, never content", () => {
    const g = check("gated:/admin");
    const ni = { "x-robots-tag": "noindex, nofollow" };
    expect(
      g.judge(
        res({ status: 307, headers: { ...ni, location: "/login" } }),
        true,
      ),
    ).toBe(true);
    expect(
      g.judge(
        res({ headers: ni, body: "NEXT_REDIRECT;replace;/login;307;" }),
        true,
      ),
    ).toBe(true);
    expect(
      g.judge(res({ headers: ni, body: "<h1>운영 콘솔</h1>" }), true),
    ).toBe(false);
    expect(
      g.judge(res({ body: "NEXT_REDIRECT;replace;/login;307;" }), true),
    ).toBe(false); // missing noindex
  });

  it("robots and sitemap keep private routes out", () => {
    expect(
      check("robots").judge(
        res({ body: "User-Agent: *\nDisallow: /admin/\n" }),
        true,
      ),
    ).toBe(true);
    expect(
      check("robots").judge(res({ body: "User-Agent: *\nAllow: /\n" }), true),
    ).toBe(false);
    const sm = check("sitemap");
    expect(
      sm.judge(res({ body: "<urlset><url>/creators</url></urlset>" }), true),
    ).toBe(true);
    expect(
      sm.judge(res({ body: "<urlset><url>/dashboard</url></urlset>" }), true),
    ).toBe(false);
  });

  it("anonymous private APIs must answer 401 with no-store", () => {
    const a = check("api-auth:/api/notifications");
    expect(
      a.judge(
        res({ status: 401, headers: { "cache-control": "private, no-store" } }),
        true,
      ),
    ).toBe(true);
    expect(
      a.judge(
        res({ status: 200, headers: { "cache-control": "no-store" } }),
        true,
      ),
    ).toBe(false);
  });

  it("summarizes failures by id", () => {
    expect(
      summarize([
        { id: "a", path: "/", expect: "", ok: true, status: 200 },
        { id: "b", path: "/x", expect: "", ok: false, status: 500 },
      ]),
    ).toEqual({ total: 2, passed: 1, failed: ["b"], verdict: "FAIL" });
  });
});
