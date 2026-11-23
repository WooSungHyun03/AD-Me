import { beforeEach, expect, it, vi } from "vitest";
import { GET, POST, PATCH } from "@/app/api/deliverables/route";
import { PATCH as TRANSITION } from "@/app/api/proposals/route";
import {
  deliveryPageSchema,
  deliveryTransitionSchema,
} from "@/lib/deliverables";
const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  read: vi.fn(),
  user: "ad000000-0000-4000-8000-000000000a01",
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requireContext: async () => ({
    user: { id: state.user },
    db: {
      rpc: state.rpc,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: state.read }) }),
      }),
    },
  }),
}));
const id = "ad000000-0000-4000-8000-000000000a02",
  submission = "ad000000-0000-4000-8000-000000000a03",
  key = "ad000000-0000-4000-8000-000000000a04";
const request = (path: string, method: string, body: unknown) =>
  new Request("https://app.example" + path, {
    method,
    headers: {
      host: "app.example",
      origin: "https://app.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
const input = {
  proposalId: id,
  expectedVersion: 0,
  clientKey: key,
  body: "가상 결과물 설명입니다.",
  url: "https://example.test/fixture-result",
  declaration: "marked",
  confirmed: true,
};
const page = {
  version: 1,
  proposalId: id,
  status: "accepted",
  roomRevision: 0,
  enforced: true,
  legacyCompleted: false,
  canCreate: true,
  canAttest: false,
  canSubmit: false,
  canReview: false,
  needsNewVersion: false,
  active: null,
  items: [],
  nextVersion: null,
};
beforeEach(() => {
  state.rpc.mockReset();
  state.read.mockReset();
  state.rpc.mockResolvedValue({ data: submission, error: null });
  state.read.mockResolvedValue({
    data: {
      id,
      brand_id: state.user,
      creator_user_id: key,
      kind: "proposal",
      status: "submitted",
    },
    error: null,
  });
});
it("creates only an explicit declaration bound to a room revision and stable retry key", async () => {
  const res = await POST(request("/api/deliverables", "POST", input));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, id: submission });
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith("delivery_create", {
    p_proposal: id,
    p_expected: 0,
    p_key: key,
    p_body: input.body,
    p_url: input.url,
    p_declaration: "marked",
  });
});
it("rejects missing confirmation, credentials, forged actor fields and invalid revisions before RPC", async () => {
  for (const data of [
    { ...input, confirmed: false },
    { ...input, url: "https://user:secret@example.org/x" },
    { ...input, expectedVersion: -1 },
    { ...input, actorId: key },
  ])
    expect(
      (await POST(request("/api/deliverables", "POST", data))).status,
    ).toBe(422);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("validates private page ownership/shape and no-store, never accepting actor metadata additions", async () => {
  state.rpc.mockResolvedValue({ data: page, error: null });
  const res = await GET(
    new Request(`https://app.example/api/deliverables?proposalId=${id}`),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  expect(await res.json()).toEqual(page);
  state.rpc.mockResolvedValue({
    data: { ...page, actor_id: "PRIVATE" },
    error: null,
  });
  expect(
    (
      await GET(
        new Request(`https://app.example/api/deliverables?proposalId=${id}`),
      )
    ).status,
  ).toBe(503);
  state.rpc.mockResolvedValue({
    data: { ...page, proposalId: key },
    error: null,
  });
  expect(
    (
      await GET(
        new Request(`https://app.example/api/deliverables?proposalId=${id}`),
      )
    ).status,
  ).toBe(503);
});
it("keeps legacy invalid links from poisoning the private history while retaining snapshot text", () => {
  const s = {
    id: submission,
    version: 1,
    body: "이전 가상 제출본",
    url: "https://user:secret@example.org/file",
    legacy: true,
    createdAt: "2026-11-20T00:00:00Z",
    attestation: null,
    events: [],
  };
  const parsed = deliveryPageSchema.parse({ ...page, active: s, items: [s] });
  expect(parsed.active?.url).toBeNull();
  expect(parsed.active?.body).toBe(s.body);
});
it("requires review grounds and advertising check for completion; revision may request missing checks", () => {
  const data = {
    id,
    submissionId: submission,
    expectedVersion: 3,
    clientKey: key,
    action: "completed",
    reviewNote: "가상 검토 근거를 기록합니다.",
    advertisingChecked: true,
  };
  expect(deliveryTransitionSchema.safeParse(data).success).toBe(true);
  expect(
    deliveryTransitionSchema.safeParse({ ...data, advertisingChecked: false })
      .success,
  ).toBe(false);
  expect(
    deliveryTransitionSchema.safeParse({ ...data, reviewNote: "짧음" }).success,
  ).toBe(false);
  expect(
    deliveryTransitionSchema.safeParse({
      ...data,
      action: "revision_requested",
      advertisingChecked: false,
    }).success,
  ).toBe(true);
});
it("routes versioned transition without the legacy state precheck so lost acknowledgements can replay safely", async () => {
  state.read.mockResolvedValue({
    data: {
      id,
      brand_id: state.user,
      creator_user_id: key,
      kind: "proposal",
      status: "completed",
    },
    error: null,
  });
  state.rpc.mockResolvedValue({
    data: { status: "completed", roomRevision: 8 },
    error: null,
  });
  const data = {
    id,
    action: "completed",
    submissionId: submission,
    expectedVersion: 7,
    clientKey: key,
    reviewNote: "가상 승인 근거를 확인했습니다.",
    advertisingChecked: true,
  };
  const res = await TRANSITION(request("/api/proposals", "PATCH", data));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    ok: true,
    data: "completed",
    roomRevision: 8,
  });
  expect(state.rpc).toHaveBeenLastCalledWith("delivery_transition", {
    p_proposal: id,
    p_submission: submission,
    p_expected: 7,
    p_key: key,
    p_action: "completed",
    p_note: data.reviewNote,
    p_checked: true,
  });
});
it("rejects partial version payload and maps stale room conflicts without provider diagnostics", async () => {
  expect(
    (
      await TRANSITION(
        request("/api/proposals", "PATCH", {
          id,
          action: "completed",
          expectedVersion: 1,
        }),
      )
    ).status,
  ).toBe(422);
  expect(state.rpc).not.toHaveBeenCalled();
  state.rpc.mockResolvedValue({
    data: null,
    error: { code: "40001", message: "PRIVATE_SQL_DETAIL" },
  });
  const res = await TRANSITION(
    request("/api/proposals", "PATCH", {
      id,
      action: "completed",
      submissionId: submission,
      expectedVersion: 1,
      clientKey: key,
      reviewNote: "가상 검토 근거를 기록했습니다.",
      advertisingChecked: true,
    }),
  );
  expect(res.status).toBe(409);
  expect(await res.text()).not.toContain("PRIVATE_SQL_DETAIL");
});
it("attests only the explicitly named submission and rejects false/malformed confirmation results", async () => {
  const data = {
    proposalId: id,
    submissionId: submission,
    expectedVersion: 1,
    declaration: "not_applicable",
    confirmed: true,
  };
  state.rpc.mockResolvedValue({ data: true, error: null });
  expect(
    (await PATCH(request("/api/deliverables", "PATCH", data))).status,
  ).toBe(200);
  expect(state.rpc).toHaveBeenLastCalledWith("delivery_attest", {
    p_proposal: id,
    p_submission: submission,
    p_expected: 1,
    p_declaration: "not_applicable",
  });
  state.rpc.mockResolvedValue({ data: { ok: true }, error: null });
  expect(
    (await PATCH(request("/api/deliverables", "PATCH", data))).status,
  ).toBe(503);
});
