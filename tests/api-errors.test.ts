import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  apiRoute,
  compatibleApiRoute,
  MAX_API_JSON_BYTES,
  failDatabase,
  parseBody,
  requireContext,
} from "@/lib/api";

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
  it.each([
    "",
    "text/plain",
    "multipart/form-data; boundary=forged",
    "application/problem+json",
  ])(
    "a forged media type cannot bypass the default body bound: %s",
    async (type) => {
      const handler = vi.fn(() => Response.json({ ok: true }));
      const post = compatibleApiRoute("media.post", handler);
      const response = await post(
        request("x".repeat(MAX_API_JSON_BYTES + 1), { "content-type": type }),
      );
      expect(response.status).toBe(413);
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it("preserves real multipart fields within the upload's explicit limit", async () => {
    const upload = compatibleApiRoute(
      "file.post",
      async (req) => {
        const form = await req.formData();
        const file = form.get("file") as File;
        return Response.json({
          name: file.name,
          bytes: file.size,
          caption: form.get("caption"),
        });
      },
      { maxBodyBytes: 2 * MAX_API_JSON_BYTES },
    );
    const form = new FormData();
    form.set("caption", "가상 파일 QA");
    form.set(
      "file",
      new File([new Uint8Array(MAX_API_JSON_BYTES + 1)], "fixture.pdf", {
        type: "application/pdf",
      }),
    );
    const req = new Request("https://preview.example/api/upload", {
      method: "POST",
      headers: { host: "preview.example" },
      body: form,
    });
    const response = await upload(req);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      name: "fixture.pdf",
      bytes: MAX_API_JSON_BYTES + 1,
      caption: "가상 파일 QA",
    });
  });
  it("preserves immutable redirect responses without mutating the original", async () => {
    const original = Response.redirect(
      "https://preview.example/dashboard",
      307,
    );
    const get = apiRoute("redirect.get", () => original);
    const response = await get(
      new Request("https://preview.example/api/example"),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://preview.example/dashboard",
    );
    expect(response.headers.get("x-request-id")).toMatch(/^[a-f0-9-]{36}$/);
    expect(original.headers.has("x-request-id")).toBe(false);
  });

  it.each(["absent", "lying", "announced"])(
    "bounds actual UTF-8 bytes (%s length)",
    async (mode) => {
      const post = apiRoute("bounded.post", async (req) =>
        Response.json(await parseBody(req, z.string(), "잘못된 입력입니다.")),
      );
      const response = await post(
        request(
          JSON.stringify("한".repeat(Math.ceil(MAX_API_JSON_BYTES / 3))),
          mode === "absent"
            ? {}
            : {
                "content-length":
                  mode === "lying" ? "1" : String(MAX_API_JSON_BYTES + 1),
              },
        ),
      );
      expect(response.status).toBe(413);
      const error = await response.json();
      expect(error.error).toMatchObject({
        code: "PAYLOAD_TOO_LARGE",
        requestId: response.headers.get("x-request-id"),
      });
      expect(JSON.stringify(error)).not.toContain("한");
    },
  );

  it("accepts the exact byte limit and rejects the next byte", async () => {
    const post = apiRoute("boundary.post", async (req) => {
      await parseBody(req, z.string(), "입력 오류");
      return Response.json({ ok: true });
    });
    expect(
      (await post(request(JSON.stringify("x".repeat(MAX_API_JSON_BYTES - 2)))))
        .status,
    ).toBe(200);
    expect(
      (await post(request(JSON.stringify("x".repeat(MAX_API_JSON_BYTES - 1)))))
        .status,
    ).toBe(413);
  });

  it("cancels an oversized streamed body without trusting Content-Length", async () => {
    const cancel = vi.fn();
    let n = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(MAX_API_JSON_BYTES / 2 + 1));
        n++;
      },
      cancel,
    });
    const req = new Request("https://preview.example/api/example", {
      method: "POST",
      body: stream,
      duplex: "half",
      headers: { host: "preview.example", "content-type": "application/json" },
    } as RequestInit);
    const post = compatibleApiRoute("stream.post", async () =>
      Response.json({ ok: true }),
    );
    expect((await post(req)).status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(n).toBeLessThanOrEqual(3);
  });

  it("preserves route context, JSON, method and URL in legacy handlers", async () => {
    const post = compatibleApiRoute(
      "legacy.post",
      async (req, context: { params: Promise<{ id: string }> }) =>
        Response.json({
          body: await req.json(),
          params: await context.params,
          method: req.method,
          url: req.url,
        }),
    );
    const res = await post(request('{"value":"원문"}'), {
      params: Promise.resolve({ id: "fictional" }),
    });
    expect(await res.json()).toEqual({
      body: { value: "원문" },
      params: { id: "fictional" },
      method: "POST",
      url: "https://preview.example/api/example",
    });
  });

  it("retains separately bounded bulk/CSV and multipart contracts", async () => {
    const bulk = compatibleApiRoute(
      "bulk.post",
      async (req) => Response.json({ bytes: (await req.text()).length }),
      { maxBodyBytes: 2 * MAX_API_JSON_BYTES },
    );
    expect(
      (await bulk(request(JSON.stringify("x".repeat(MAX_API_JSON_BYTES)))))
        .status,
    ).toBe(200);
    const upload = compatibleApiRoute(
      "upload.post",
      async (req) => Response.json({ bytes: (await req.text()).length }),
      { maxBodyBytes: 2 * MAX_API_JSON_BYTES },
    );
    const response = await upload(
      request("x".repeat(MAX_API_JSON_BYTES + 1), {
        "content-type": "multipart/form-data; boundary=fixture",
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).bytes).toBe(MAX_API_JSON_BYTES + 1);
    expect(() =>
      compatibleApiRoute("bad", () => Response.json({}), {
        maxBodyBytes: Infinity,
      }),
    ).toThrow("Invalid API body limit");
  });
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
    ["54000", 429, "RATE_LIMITED"],
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
