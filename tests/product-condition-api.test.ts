import { beforeEach, expect, it, vi } from "vitest";
import { POST, GET, PATCH } from "@/app/api/product-conditions/route";
import {
  fictionalProductSource,
  syntheticProductOutput,
} from "./support/product-condition-fixture.mjs";
const state = vi.hoisted(() => ({ rpc: vi.fn(), role: "brand" }));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requireContext: async () => ({
    user: { id: "owner" },
    role: state.role,
    db: { rpc: state.rpc },
  }),
  requireFeature: () => {},
}));
const id = "ad000000-0000-4000-8000-000000000001",
  product = "ad000000-0000-4000-8000-000000000002",
  key = "ad000000-0000-4000-8000-000000000003";
const page = () => ({
  id,
  productId: product,
  sourceVersion: "a".repeat(64),
  source: fictionalProductSource,
  expiresAt: "2026-11-24T10:00:00Z",
  status: "done",
  decision: "pending",
  revision: 0,
  selected: [],
  output: syntheticProductOutput(),
});
const req = (method: string, body?: unknown, query = "") =>
  new Request(`https://app.example/api/product-conditions${query}`, {
    method,
    headers: {
      host: "app.example",
      origin: "https://app.example",
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
beforeEach(() => {
  state.rpc.mockReset();
  state.role = "brand";
});
it("creates only an owner-selected product/key/audience request and never accepts source/owner/model injection", async () => {
  state.rpc.mockResolvedValue({ data: id, error: null });
  const input = {
    productId: product,
    audience: "가상 성인 고객",
    clientKey: key,
  };
  const r = await POST(req("POST", input));
  expect(r.status).toBe(202);
  expect(await r.json()).toEqual({ id });
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    "product_conditions_create",
    { p_product: product, p_audience: input.audience, p_key: key },
  );
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  state.rpc.mockClear();
  for (const extra of [
    { ownerId: key },
    { source: fictionalProductSource },
    { model: "fake" },
    { sourceVersion: "a".repeat(64) },
  ])
    expect((await POST(req("POST", { ...input, ...extra }))).status).toBe(422);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("reads a verified source-bound DTO and permits null only for latest, not an explicit ID", async () => {
  state.rpc.mockResolvedValue({ data: page(), error: null });
  const r = await GET(req("GET", undefined, `?id=${id}`));
  expect(r.status).toBe(200);
  expect((await r.json()).output.sourceContract).toBe("owned-product-v1");
  state.rpc.mockResolvedValue({ data: null, error: null });
  expect(
    (await GET(req("GET", undefined, `?productId=${product}`))).status,
  ).toBe(200);
  expect((await GET(req("GET", undefined, `?id=${id}`))).status).toBe(503);
});
it("refuses foreign/malformed/mismatched source, stale schema and duplicate/extra query values", async () => {
  for (const value of [
    { ...page(), productId: key },
    {
      ...page(),
      output: { ...page().output, modelSourceVersion: "b".repeat(64) },
    },
    { ...page(), selected: [page().output.suggestions[0]] },
    { ...page(), output: { ...page().output, ownerId: key } },
  ]) {
    state.rpc.mockResolvedValue({ data: value, error: null });
    expect(
      (await GET(req("GET", undefined, `?productId=${product}`))).status,
    ).toBe(503);
  }
  state.rpc.mockClear();
  for (const query of [
    `?id=${id}&id=${key}`,
    `?id=${id}&ownerId=${key}`,
    `?id=${id}&productId=${product}`,
  ])
    expect((await GET(req("GET", undefined, query))).status).toBe(422);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("confirms only indexed selections through CAS/key and re-reads the server chosen result", async () => {
  const done = {
    ...page(),
    decision: "confirmed",
    revision: 1,
    selected: [page().output.suggestions[0]],
  };
  state.rpc.mockImplementation(async (name) => ({
    data: name === "product_conditions_get" ? done : null,
    error: null,
  }));
  const r = await PATCH(
    req("PATCH", {
      id,
      clientKey: key,
      expectedVersion: 0,
      action: "confirm",
      selected: [0],
    }),
  );
  expect(r.status).toBe(200);
  expect((await r.json()).decision).toBe("confirmed");
  expect(state.rpc).toHaveBeenNthCalledWith(1, "product_conditions_decide", {
    p_id: id,
    p_key: key,
    p_revision: 0,
    p_action: "confirm",
    p_selected: [0],
  });
  state.rpc.mockClear();
  expect(
    (
      await PATCH(
        req("PATCH", {
          id,
          clientKey: key,
          expectedVersion: 0,
          action: "confirm",
          selected: [0, 0],
        }),
      )
    ).status,
  ).toBe(422);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("denies other roles and preserves safe missing/conflict/quota/disabled errors", async () => {
  state.role = "creator";
  expect((await POST(req("POST", {}))).status).toBe(403);
  expect((await GET(req("GET", undefined, `?id=${id}`))).status).toBe(403);
  expect(state.rpc).not.toHaveBeenCalled();
  state.role = "brand";
  for (const [code, status] of [
    ["PT404", 404],
    ["23505", 409],
    ["PT429", 429],
    ["42501", 403],
  ] as const) {
    state.rpc.mockResolvedValue({
      data: null,
      error: { code, message: "PRIVATE CANARY" },
    });
    const r = await POST(
      req("POST", {
        productId: product,
        audience: "가상 타깃",
        clientKey: key,
      }),
    );
    expect(r.status).toBe(status);
    expect(await r.text()).not.toContain("PRIVATE CANARY");
  }
});
