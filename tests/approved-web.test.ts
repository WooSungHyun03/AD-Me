import { expect, it, vi } from "vitest";
import {
  fetchApprovedWeb,
  isPublicWebAddress,
  robotsPermit,
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
  download: vi.fn(async (u: URL) => ({
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
