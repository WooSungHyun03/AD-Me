import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiRoute, failDatabase, parseBody, requireContext } from "@/lib/api";

const db = vi.hoisted(() => ({
  configured: vi.fn(),
  getUser: vi.fn(),
  profile: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  configured: db.configured,
  supabase: async () => ({
    auth: { getUser: db.getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: db.profile }) }),
    }),
  }),
}));

afterEach(() => vi.restoreAllMocks());

function request(body = "{}", headers: Record<string, string> = {}) {
  return new Request("https://preview.example/api/example", {
    method: "POST",
    headers: {
      host: "preview.example",
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
}

describe("API errors", () => {
  it("distinguishes unreadable JSON and invalid fields with correlatable IDs", async () => {
    const post = apiRoute("example.post", async (req) =>
      Response.json(
        await parseBody(req, z.object({ id: z.uuid() }), "ID를 확인해주세요."),
      ),
    );
    const malformed = await post(request("{"));
    const invalid = await post(
      request('{"id":"fixture"}', { "X-Request-Id": "caller" }),
    );
    expect(malformed.status).toBe(400);
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toEqual({
      error: {
        message: "ID를 확인해주세요.",
        code: "INVALID_INPUT",
        requestId: invalid.headers.get("X-Request-Id"),
      },
    });
    expect(invalid.headers.get("Cache-Control")).toBe("no-store");
    expect(invalid.headers.get("X-Request-Id")).not.toBe("caller");
    expect(invalid.headers.get("X-Request-Id")).not.toBe(
      malformed.headers.get("X-Request-Id"),
    );
  });

  it("denies browser cross-site writes before the handler runs", async () => {
    const handler = vi.fn(() => Response.json({ ok: true }));
    const post = apiRoute("example.post", handler);
    expect(
      (await post(request("{}", { origin: "https://outside.example" }))).status,
    ).toBe(403);
    expect(
      (await post(request("{}", { "sec-fetch-site": "cross-site" }))).status,
    ).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(
      (await post(request("{}", { origin: "https://preview.example" }))).status,
    ).toBe(200);
  });

  it.each([
    ["42501", 403, "FORBIDDEN"],
    ["23505", 409, "CONFLICT"],
    ["08006", 503, "SERVICE_UNAVAILABLE"],
    ["22023", 422, "INVALID_INPUT"],
    ["P0002", 404, "NOT_FOUND"],
  ])(
    "maps database code %s without sending provider messages",
    async (code, status, label) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const dbError = { code, message: "SELECT private_column; TOKEN_FIXTURE" };
      const post = apiRoute("example.post", () =>
        failDatabase(dbError, "저장에 실패했습니다."),
      );
      const result = await post(request());
      expect(result.status).toBe(status);
      expect(await result.json()).toEqual({
        error: {
          message: "저장에 실패했습니다.",
          code: label,
          requestId: result.headers.get("X-Request-Id"),
        },
      });
      expect(JSON.stringify(log.mock.calls)).not.toMatch(
        /TOKEN_FIXTURE|SELECT/,
      );
    },
  );

  it("returns generic responses and logs safe metadata for unknown throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const post = apiRoute("example.post", () => {
      throw new Error("RAW_TOKEN_FIXTURE");
    });
    const result = await post(request());
    const requestId = result.headers.get("X-Request-Id");
    expect(result.status).toBe(500);
    expect(await result.text()).not.toContain("RAW_TOKEN_FIXTURE");
    expect(log).toHaveBeenCalledExactlyOnceWith("api_error", {
      operation: "example.post",
      code: "INTERNAL_ERROR",
      requestId,
    });
  });

  it("distinguishes missing auth, throttling and provider unavailability", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const post = apiRoute("example.post", async () => {
      await requireContext();
      return Response.json({ ok: true });
    });
    db.configured.mockReturnValue(false);
    expect((await post(request())).status).toBe(503);
    db.configured.mockReturnValue(true);
    db.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError" },
    });
    expect((await post(request())).status).toBe(401);
    db.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 429 },
    });
    expect((await post(request())).status).toBe(429);
    db.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 502 },
    });
    expect((await post(request())).status).toBe(503);
    expect(log).toHaveBeenCalledTimes(2);
  });
});
