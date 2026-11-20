import { beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/recommendations/route";
import { recommendationResultSchema } from "@/lib/recommendation-snapshots";
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requireContext: async () => ({
    user: { id: "owner" },
    db: { rpc: state.rpc },
  }),
}));
const id = "ad000000-0000-4000-8000-000000000a01",
  key = "ad000000-0000-4000-8000-000000000a02";
const request = (data: unknown) =>
  new Request("https://app.example/api/recommendations", {
    method: "POST",
    headers: {
      host: "app.example",
      origin: "https://app.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
beforeEach(() => {
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({ data: key, error: null });
});
it("sends only campaign/key and accepts DB-chosen snapshot ID", async () => {
  const r = await POST(request({ campaignId: id, clientKey: key }));
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ ok: true, id: key });
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith("recommendation_create", {
    p_campaign: id,
    p_key: key,
  });
  expect(r.headers.get("cache-control")).toBe("no-store");
});
it("rejects client score/model/source/owner/HOT injection and malformed keys", async () => {
  for (const extra of [
    { score: 100 },
    { modelVersion: "paid" },
    { hot: true },
    { ownerId: key },
    { sourceVersion: "fake" },
    { clientKey: "wrong" },
  ])
    expect(
      (await POST(request({ campaignId: id, clientKey: key, ...extra })))
        .status,
    ).toBe(422);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("returns stable v1 errors for denied, conflicting and quota-limited requests", async () => {
  for (const [code, status] of [
    ["42501", 403],
    ["23505", 409],
    ["PT429", 429],
  ] as const) {
    state.rpc.mockResolvedValue({
      data: null,
      error: { code, message: "PRIVATE canary" },
    });
    const r = await POST(request({ campaignId: id, clientKey: key }));
    expect(r.status).toBe(status);
    expect(JSON.stringify(await r.json())).not.toContain("PRIVATE");
  }
});
it("fails closed on malformed success and wrong campaign snapshot responses", async () => {
  state.rpc.mockResolvedValue({ data: "forged", error: null });
  expect((await POST(request({ campaignId: id, clientKey: key }))).status).toBe(
    503,
  );
  state.rpc.mockResolvedValue({
    data: { version: 1, campaignId: key, snapshot: null, history: [] },
    error: null,
  });
  expect(
    (
      await GET(
        new Request(`https://app.example/api/recommendations?campaignId=${id}`),
      )
    ).status,
  ).toBe(503);
});
it("validates private history reads and preserves null before first explicit save", async () => {
  state.rpc.mockResolvedValue({
    data: { version: 1, campaignId: id, snapshot: null, history: [] },
    error: null,
  });
  const r = await GET(
    new Request(`https://app.example/api/recommendations?campaignId=${id}`),
  );
  expect(r.status).toBe(200);
  expect((await r.json()).snapshot).toBeNull();
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith("recommendation_page", {
    p_campaign: id,
    p_snapshot: null,
  });
  state.rpc.mockClear();
  expect(
    (
      await GET(
        new Request(
          `https://app.example/api/recommendations?campaignId=${id}&ownerId=${key}`,
        ),
      )
    ).status,
  ).toBe(422);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("rejects a requested snapshot ID being silently replaced by the latest record", async () => {
  state.rpc.mockResolvedValue({
    data: { version: 1, campaignId: id, snapshot: null, history: [] },
    error: null,
  });
  expect(
    (
      await GET(
        new Request(
          `https://app.example/api/recommendations?campaignId=${id}&snapshotId=${key}`,
        ),
      )
    ).status,
  ).toBe(503);
});
it("does not accept arbitrary persisted result JSON as a curated DTO", () => {
  expect(
    recommendationResultSchema.safeParse({
      creatorId: "x",
      score: 100,
      owner_id: key,
    }).success,
  ).toBe(false);
});
