import { beforeEach, expect, it, vi } from "vitest";
import { apiRoute, failDatabase } from "@/lib/api";
import { readRateLimitedDraft } from "@/lib/rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";
const rpc = vi.fn();
const db = { rpc } as unknown as SupabaseClient;
const request = new Request("https://example.test/api/intelligence");
beforeEach(() => vi.resetAllMocks());
it("uses only DB-chosen account quota and returns exact bounded retry metadata", async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { code: "PT429", details: '{"retryAfter":37}' },
  });
  const response = await apiRoute("test", async () => {
    await readRateLimitedDraft(db, "fixture");
    return Response.json({ ok: true });
  })(request);
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("37");
  expect(await response.json()).toMatchObject({
    error: { code: "RATE_LIMITED" },
  });
  expect(rpc).toHaveBeenCalledExactlyOnceWith("ops_draft_get", {
    p_id: "fixture",
  });
});
it.each([
  undefined,
  { status: "unexpected", output: null },
  { output: null },
  { status: 99, output: null },
])("fails closed on malformed quota responses", async (data) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  rpc.mockResolvedValue({ data, error: null });
  const response = await apiRoute("test", async () => {
    await readRateLimitedDraft(db, "fixture");
    return Response.json({ ok: true });
  })(request);
  expect(response.status).toBe(503);
});
it("maps an absent or inaccessible draft to404 and strips private provider fields", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  expect(
    (
      await apiRoute("test", async () =>
        Response.json(await readRateLimitedDraft(db, "fixture")),
      )(request)
    ).status,
  ).toBe(404);
  rpc.mockResolvedValue({
    data: { status: "queued", output: null, error: "PRIVATE_FIXTURE" },
    error: null,
  });
  expect(await readRateLimitedDraft(db, "fixture")).toEqual({
    status: "queued",
    output: null,
  });
});
it.each([
  ['{"retryAfter":19}', "19"],
  ['{"retryAfter":"token"}', "60"],
  ["not-json", "60"],
  ['{"retryAfter":999999}', "60"],
])("sanitizes direct DB retry details %s", async (details, expected) => {
  const response = await apiRoute("test", () =>
    failDatabase({ code: "PT429", details }, "요청 한도"),
  )(request);
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe(expected);
  expect(await response.text()).not.toContain("token");
});
