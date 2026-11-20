import { beforeEach, expect, it, vi } from "vitest";
import { apiRoute, failDatabase } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";
const rpc = vi.fn();
const db = { rpc } as unknown as SupabaseClient;
const request = new Request("https://example.test/api/intelligence");
beforeEach(() => vi.resetAllMocks());
it("uses only DB-chosen account quota and returns exact bounded retry metadata", async () => {
  rpc.mockResolvedValue({
    data: { allowed: false, retryAfter: 37 },
    error: null,
  });
  const response = await apiRoute("test", async () => {
    await enforceRateLimit(db, "draft_poll");
    return Response.json({ ok: true });
  })(request);
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("37");
  expect(await response.json()).toMatchObject({
    error: { code: "RATE_LIMITED" },
  });
  expect(rpc).toHaveBeenCalledWith("ops_request_quota", {
    p_action: "draft_poll",
  });
});
it.each([
  null,
  { allowed: true, retryAfter: -1 },
  { allowed: true, retryAfter: 1.5 },
  { allowed: true, retryAfter: 86401 },
])("fails closed on malformed quota responses", async (data) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  rpc.mockResolvedValue({ data, error: null });
  const response = await apiRoute("test", async () => {
    await enforceRateLimit(db, "draft_poll");
    return Response.json({ ok: true });
  })(request);
  expect(response.status).toBe(503);
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
