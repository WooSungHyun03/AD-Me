import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/proposals/route";
const state = vi.hoisted(() => ({ role: "brand", rpc: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requireContext: async () => ({
    role: state.role,
    user: { id: "private-caller" },
    db: { rpc: state.rpc },
  }),
}));
const id = "ad000000-0000-4000-8000-000000000701";
const body = {
  campaignId: id,
  creatorId: "legacy-creator",
  kind: "proposal",
  brief: "기존 ID로 협업을 제안합니다.",
};
const req = (data = body) =>
  new Request("https://app.example/api/proposals", {
    method: "POST",
    headers: {
      origin: "https://app.example",
      host: "app.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
beforeEach(() => {
  state.role = "brand";
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({ data: id, error: null });
});
it("preserves the old POST contract and never reads/accepts owner IDs from the public client", async () => {
  const response = await POST(req());
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ id });
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith("create_creator_proposal", {
    p_campaign: id,
    p_creator: body.creatorId,
    p_kind: "proposal",
    p_brief: body.brief,
  });
});
it("retains duplicate409 and forbidden403 mappings without leaking database messages", async () => {
  for (const [code, expected] of [
    ["23505", 409],
    ["42501", 403],
    ["23514", 422],
  ]) {
    state.rpc.mockResolvedValue({
      data: null,
      error: { code, message: "PRIVATE_DATABASE_DETAIL" },
    });
    const response = await POST(req());
    expect(response.status).toBe(expected);
    expect(await response.text()).not.toContain("PRIVATE_DATABASE_DETAIL");
  }
});
it("rejects opposite roles before RPC and malformed RPC output after validation", async () => {
  state.role = "creator";
  expect((await POST(req())).status).toBe(403);
  expect(state.rpc).not.toHaveBeenCalled();
  state.role = "brand";
  state.rpc.mockResolvedValue({ data: { owner_id: "bad-shape" }, error: null });
  expect((await POST(req())).status).toBe(503);
});
it("returns a safe conflict for the central application window gate", async () => {
  state.role = "creator";
  state.rpc.mockResolvedValue({
    data: null,
    error: { code: "PT409", message: "RECRUITMENT_NOT_OPEN" },
  });
  const response = await POST(req({ ...body, kind: "application" }));
  expect(response.status).toBe(409);
  expect((await response.json()).error.message).toBe(
    "현재 모집 기간 또는 모집 인원을 확인해주세요.",
  );
});
