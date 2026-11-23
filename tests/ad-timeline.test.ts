import { expect, it, vi, beforeEach } from "vitest";
import {
  adFilterSchema,
  adCursorSchema,
  adPageArgs,
  competitorSchema,
} from "@/lib/ad-timeline";
import { GET } from "@/app/api/ad-history/search/route";
import { POST } from "@/app/api/ad-history/competitors/route";
const state = vi.hoisted(() => ({ rpc: vi.fn(), role: "brand" }));
vi.mock("@/lib/supabase", () => ({
  configured: () => true,
  supabase: async () => ({ rpc: state.rpc }),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requireContext: async () => ({ role: state.role, db: { rpc: state.rpc } }),
}));
beforeEach(() => {
  state.role = "brand";
  state.rpc.mockReset();
});
it("rejects inverted/invalid dates, actor injection, malformed cursor and too many rivals", () => {
  expect(
    adFilterSchema.safeParse({
      creatorId: "x",
      from: "2026-03-01",
      to: "2026-02-01",
    }).success,
  ).toBe(false);
  expect(
    adFilterSchema.safeParse({ creatorId: "x", from: "2026-02-30" }).success,
  ).toBe(false);
  expect(
    adFilterSchema.safeParse({ creatorId: "x", owner_id: "forged" }).success,
  ).toBe(false);
  expect(adCursorSchema.safeParse({ id: "forged" }).success).toBe(false);
  expect(competitorSchema.safeParse(Array(21).fill("가상")).success).toBe(
    false,
  );
  expect(
    adPageArgs(adFilterSchema.parse({ creatorId: "x" })).p_from,
  ).toBeNull();
});
it("search returns a private no-store minimal page and fails closed on wrong DTO", async () => {
  state.rpc.mockResolvedValue({
    data: { version: 1, items: [], nextCursor: null, total: 0 },
    error: null,
  });
  const res = await GET(
    new Request("http://localhost/api/ad-history/search?creatorId=x"),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get("Cache-Control")).toContain("no-store");
  expect(state.rpc).toHaveBeenCalledWith(
    "ad_history_page",
    expect.objectContaining({ p_creator: "x", p_limit: 20 }),
  );
  state.rpc.mockResolvedValue({
    data: { private_email: "secret" },
    error: null,
  });
  expect(
    (
      await GET(
        new Request("http://localhost/api/ad-history/search?creatorId=x"),
      )
    ).status,
  ).toBe(503);
});
it("foreign owner, creator rival edits and unsafe cursor fail before DB", async () => {
  expect(
    (
      await GET(
        new Request(
          "http://localhost/api/ad-history/search?creatorId=x&cursor=bad",
        ),
      )
    ).status,
  ).toBe(422);
  state.role = "creator";
  expect(
    (
      await POST(
        new Request("http://localhost/api/ad-history/competitors", {
          method: "POST",
          headers: { origin: "http://localhost" },
          body: '["가상 브랜드"]',
        }),
      )
    ).status,
  ).toBe(403);
  expect(state.rpc).not.toHaveBeenCalled();
});
