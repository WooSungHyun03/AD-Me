// D088: anonymous, read-only release smoke for a deployed URL. It never signs in, creates accounts,
// writes data or pays; it only records what an anonymous visitor gets. Role flows, real data and Toss
// TEST stay separate gates (U004/U005/U006/U019). No imports so scripts/release-smoke.mjs can load it
// with Node type stripping.

export type SmokeResponse = {
  status: number;
  headers: Record<string, string>; // lower-case names
  body: string; // first bytes only
};
export type SmokeCheck = {
  id: string;
  path: string;
  expect: string;
  judge: (r: SmokeResponse, https: boolean) => boolean;
};
export type SmokeResult = {
  id: string;
  path: string;
  expect: string;
  ok: boolean;
  status: number;
};

const header = (r: SmokeResponse, name: string) => r.headers[name] ?? "";
const noindex = (r: SmokeResponse) =>
  /noindex/i.test(header(r, "x-robots-tag"));
// Server redirects to /login arrive either as 3xx or, when streamed, as a 200 page whose payload
// carries NEXT_REDIRECT to /login (with a meta refresh fallback).
const sendsToLogin = (r: SmokeResponse) =>
  (r.status >= 300 &&
    r.status < 400 &&
    /^(https?:\/\/[^/]+)?\/login/.test(header(r, "location"))) ||
  (r.status === 200 &&
    (/NEXT_REDIRECT;[a-z]+;\/login/.test(r.body) ||
      /http-equiv="refresh" content="\d+;url=\/login/.test(r.body)));
// Markers that must never reach a browser: service role names/keys and secret-key prefixes.
const SECRET_MARKERS =
  /service_role|SUPABASE_SERVICE_ROLE|sb_secret_|TOSS_SECRET|test_sk_|live_sk_/;
const PUBLIC_PAGES = [
  "/",
  "/creators",
  "/pricing",
  "/privacy",
  "/terms",
  "/login",
];

export const SMOKE_CHECKS: SmokeCheck[] = [
  {
    id: "health",
    path: "/api/health",
    expect: '200 {"status":"ok"} only, no-store',
    judge: (r) =>
      r.status === 200 &&
      r.body.trim() === '{"status":"ok"}' &&
      /no-store/.test(header(r, "cache-control")),
  },
  ...PUBLIC_PAGES.map((path) => ({
    id: `public:${path}`,
    path,
    expect: "200 without secret markers",
    judge: (r: SmokeResponse) =>
      r.status === 200 && !SECRET_MARKERS.test(r.body),
  })),
  {
    id: "security-headers",
    path: "/",
    expect: "CSP, nosniff, frame DENY, referrer policy; HSTS on https",
    judge: (r, https) =>
      /default-src/.test(header(r, "content-security-policy")) &&
      header(r, "x-content-type-options") === "nosniff" &&
      header(r, "x-frame-options") === "DENY" &&
      header(r, "referrer-policy") !== "" &&
      (!https || /max-age=\d+/.test(header(r, "strict-transport-security"))),
  },
  {
    id: "robots",
    path: "/robots.txt",
    expect: "200; /admin disallowed (or whole site in demo mode)",
    judge: (r) => r.status === 200 && /^Disallow: \/(admin\/?)?$/m.test(r.body),
  },
  {
    id: "sitemap",
    path: "/sitemap.xml",
    expect: "200 XML without private routes",
    judge: (r) =>
      r.status === 200 &&
      /<urlset/.test(r.body) &&
      !/\/(admin|dashboard|settings)\b/.test(r.body),
  },
  ...["/dashboard", "/admin"].map((path) => ({
    id: `gated:${path}`,
    path,
    expect: "anonymous visitor is sent to /login; noindex",
    judge: (r: SmokeResponse) => sendsToLogin(r) && noindex(r),
  })),
  ...["/api/notifications", "/api/export"].map((path) => ({
    id: `api-auth:${path}`,
    path,
    expect: "401 for anonymous, no-store",
    judge: (r: SmokeResponse) =>
      r.status === 401 && /no-store/.test(header(r, "cache-control")),
  })),
];

export function summarize(results: SmokeResult[]) {
  const failed = results.filter((r) => !r.ok).map((r) => r.id);
  return {
    total: results.length,
    passed: results.length - failed.length,
    failed,
    verdict: failed.length ? ("FAIL" as const) : ("PASS" as const),
  };
}
