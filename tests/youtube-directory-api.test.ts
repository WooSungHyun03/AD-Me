import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/creators/youtube/route";
const fixture = vi.hoisted(() => ({
  configured: true,
  rpc: vi.fn(),
  budget: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  configured: () => fixture.configured,
  supabase: async () => ({ rpc: fixture.rpc }),
}));
vi.mock("@/lib/request-budget", () => ({
  reserveRequestBudget: fixture.budget,
}));
beforeEach(() => {
  vi.resetAllMocks();
  fixture.configured = true;
  fixture.budget.mockResolvedValue(null);
  fixture.rpc.mockResolvedValue({
    data: { version: 1, items: [], total: 0, nextCursor: null },
    error: null,
  });
});
const request = (query = "") =>
  new Request("https://example.test/api/creators/youtube?" + query);
it.each([
  "owner_id=secret",
  "q=a&q=b",
  "yt-sort=private",
  "yt-cursor=",
  "q=" + "x".repeat(81),
])("rejects invalid input before database work: %s", async (query) => {
  expect((await GET(request(query))).status).toBe(422);
  expect(fixture.rpc).not.toHaveBeenCalled();
});
it("reports connection and request-budget failures without query work", async () => {
  fixture.configured = false;
  expect((await GET(request())).status).toBe(503);
  fixture.configured = true;
  fixture.budget.mockResolvedValue(
    "요청이 많습니다. 잠시 후 다시 시도해주세요.",
  );
  expect((await GET(request())).status).toBe(429);
  expect(fixture.rpc).not.toHaveBeenCalled();
});
it("returns only validated no-store pages and hides private database error details", async () => {
  const ok = await GET(request("q=가상&yt-sort=name"));
  expect(ok.status).toBe(200);
  expect(ok.headers.get("cache-control")).toBe("no-store");
  expect(fixture.rpc).toHaveBeenCalledWith(
    "youtube_directory_page",
    expect.objectContaining({ p_limit: 24 }),
  );
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  fixture.rpc.mockResolvedValue({
    data: null,
    error: { code: "22023", message: "PRIVATE-D033" },
  });
  const bad = await GET(request("yt-cursor=invalid"));
  expect(bad.status).toBe(422);
  expect(await bad.text()).not.toContain("PRIVATE-D033");
  spy.mockRestore();
});
