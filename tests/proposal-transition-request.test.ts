import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ read: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requireContext: async () => ({
    user: { id: "actor" },
    db: {
      rpc: state.rpc,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: state.read }) }),
      }),
    },
  }),
}));
import { PATCH } from "@/app/api/proposals/route";
const id = "ad000000-0000-4000-8000-000000000801",
  key = "ad000000-0000-4000-8000-000000000802";
const request = (body: unknown) =>
  new Request("https://app.example/api/proposals", {
    method: "PATCH",
    headers: { origin: "https://app.example", host: "app.example" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  state.read.mockResolvedValue({
    data: {
      id,
      kind: "application",
      status: "pending",
      brand_id: "brand",
      creator_user_id: "actor",
    },
    error: null,
  });
  state.rpc.mockResolvedValue({ data: "cancelled", error: null });
});
it("preserves legacy sender cancellation", async () => {
  expect((await PATCH(request({ id, action: "cancelled" }))).status).toBe(200);
});
it("allows keyed acknowledgment replay even after the stored proposal advanced", async () => {
  state.read.mockResolvedValue({
    data: {
      id,
      kind: "application",
      status: "completed",
      brand_id: "brand",
      creator_user_id: "actor",
    },
    error: null,
  });
  expect(
    (
      await PATCH(
        request({
          id,
          action: "cancelled",
          requestKey: key,
          expectedStatus: "pending",
        }),
      )
    ).status,
  ).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith("transition_proposal_request", {
    p_id: id,
    p_action: "cancelled",
    p_expected: "pending",
    p_key: key,
  });
});
it("rejects partial/mixed contracts before mutation", async () => {
  for (const extra of [
    { requestKey: key },
    { expectedStatus: "pending" },
    { requestKey: key, expectedStatus: "pending", clientKey: key },
  ])
    expect(
      (await PATCH(request({ id, action: "cancelled", ...extra }))).status,
    ).toBe(422);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("denies nonparticipants before replay", async () => {
  state.read.mockResolvedValue({ data: null, error: null });
  expect(
    (
      await PATCH(
        request({
          id,
          action: "cancelled",
          requestKey: key,
          expectedStatus: "pending",
        }),
      )
    ).status,
  ).toBe(403);
  expect(state.rpc).not.toHaveBeenCalled();
});
