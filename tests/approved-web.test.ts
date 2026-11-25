import { expect, it, vi } from "vitest";
import {
  extractPublicFields,
  fetchApprovedWeb,
  isPublicWebAddress,
  robotsPermit,
  type pinnedWebDownload,
} from "@/lib/ingestion/web";
const policy = {
  approved: true,
  version: "fixture1",
  reviewRef: "fictional-review",
  host: "example.org",
  paths: ["/public"],
  expiresAt: "2099-01-01T00:00:00Z",
  minIntervalSeconds: 10,
  userAgent: "ADMe/1.0 (https://example.org/contact)",
};
const ports = () => ({
  reserve: vi.fn(async () => true),
  resolve: vi.fn(async () => ["8.8.8.8"]),
  download: vi.fn<typeof pinnedWebDownload>(async (u: URL) => ({
    status: 200,
    contentType: u.pathname === "/robots.txt" ? "text/plain" : "text/html",
    body:
      u.pathname === "/robots.txt"
        ? "User-agent: *\nDisallow: /private\n"
        : "<title>Fictional HTML</title>",
  })),
});
it("denies unapproved URLs/policies before DNS or content requests", async () => {
  const p = ports();
  for (const url of [
    "http://example.org/public",
    "https://example.org.evil.org/public",
    "https://example.org/publicity",
    "https://example.org/public?next=x",
    "https://example.org/public/%252fprivate",
    "https://127.0.0.1/public",
  ])
    await expect(fetchApprovedWeb(url, policy, p)).rejects.toThrow();
  await expect(
    fetchApprovedWeb(
      "https://example.org/public",
      { ...policy, approved: false },
      p,
    ),
  ).rejects.toThrow();
  expect(p.download).not.toHaveBeenCalled();
});
it("pins one reviewed public address and never follows a redirect or private DNS answer", async () => {
  const p = ports();
  await expect(
    fetchApprovedWeb("https://example.org/public", policy, p),
  ).resolves.toMatchObject({ policyVersion: "fixture1" });
  expect(p.reserve).toHaveBeenCalledWith("example.org", 2, 10);
  expect(p.download.mock.calls.every((c) => c[1] === "8.8.8.8")).toBe(true);
  const q = ports();
  q.resolve.mockResolvedValue(["8.8.8.8", "169.254.169.254"]);
  await expect(
    fetchApprovedWeb("https://example.org/public", policy, q),
  ).rejects.toThrow("PRIVATE");
  expect(q.download).not.toHaveBeenCalled();
});
it("fails closed on robots syntax outside the supported literal subset and private address families", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "100.64.0.1",
    "192.0.0.1",
    "192.168.1.1",
    "198.18.0.1",
    "203.0.113.1",
    "::1",
    "::ffff:8.8.8.8",
    "2001:db8::1",
  ])
    expect(isPublicWebAddress(ip)).toBe(false);
  expect(
    robotsPermit("User-agent: *\nDisallow: /\nAllow: /public", "/public", 10),
  ).toBe(true);
  expect(robotsPermit("User-agent: *\nDisallow: /*secret", "/public", 10)).toBe(
    false,
  );
  expect(robotsPermit("User-agent: *\nCrawl-delay: 30", "/public", 10)).toBe(
    false,
  );
});
it("refuses redirection, access walls and robots denial without a third request", async () => {
  for (const result of [
    { status: 302, contentType: "text/html", body: "" },
    { status: 200, contentType: "text/html", body: '<input type="password">' },
    { status: 200, contentType: "application/json", body: "{}" },
  ]) {
    const p = ports();
    p.download.mockImplementation(async (u: URL) =>
      u.pathname === "/robots.txt"
        ? {
            status: 200,
            contentType: "text/plain",
            body: "User-agent: *\nAllow: /",
          }
        : result,
    );
    await expect(
      fetchApprovedWeb("https://example.org/public", policy, p),
    ).rejects.toThrow();
    expect(p.download).toHaveBeenCalledTimes(2);
  }
  const p = ports();
  p.download.mockResolvedValue({
    status: 200,
    contentType: "text/plain",
    body: "User-agent: *\nDisallow: /",
  });
  await expect(
    fetchApprovedWeb("https://example.org/public", policy, p),
  ).rejects.toThrow("ROBOTS");
  expect(p.download).toHaveBeenCalledTimes(1);
});

it("returns only minimal public fields, never raw HTML or contact details", async () => {
  const p = ports();
  p.download.mockImplementation(async (u: URL) => ({
    status: 200,
    contentType: u.pathname === "/robots.txt" ? "text/plain" : "text/html",
    body:
      u.pathname === "/robots.txt"
        ? "User-agent: *\nDisallow: /private\n"
        : `<html><head><title> 가상 &amp; 브랜드
           소개 </title>
           <meta content="문의 owner@example.org · 010-1234-5678 · https://x.test/a" name="description">
           <link rel="canonical" href="https://example.org/public/about">
           <script>secret()</script></head><body>owner@example.org</body></html>`,
  }));
  const result = await fetchApprovedWeb(
    "https://example.org/public/about",
    policy,
    p,
    Date.parse("2026-01-01T00:00:00Z"),
  );
  expect(result).toEqual({
    fields: {
      title: "가상 & 브랜드 소개",
      description: "문의 [이메일] · [전화번호] · [링크]",
      canonical: "https://example.org/public/about",
    },
    sourceUrl: "https://example.org/public/about",
    policyVersion: "fixture1",
    reviewRef: "fictional-review",
  });
  expect(JSON.stringify(result)).not.toMatch(/owner@|secret\(|<html|<script/);
});

it("drops off-policy canonicals and caps field length", () => {
  const p = { ...policy } as Parameters<typeof extractPublicFields>[1];
  for (const href of [
    "https://evil.example/public/x",
    "https://example.org/private/x",
    "http://example.org/public/x",
    "https://example.org/public/x?track=1",
    "javascript:alert(1)",
  ])
    expect(
      extractPublicFields(`<link href='${href}' rel='canonical'>`, p).canonical,
    ).toBeNull();
  const long = extractPublicFields(
    `<title>${"가".repeat(500)}</title><meta property="og:description" content="${"나".repeat(900)}">`,
    p,
  );
  expect([long.title?.length, long.description?.length]).toEqual([200, 500]);
  expect(extractPublicFields("<p>no head</p>", p)).toEqual({
    title: null,
    description: null,
    canonical: null,
  });
});
