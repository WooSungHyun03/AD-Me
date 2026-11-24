import "server-only";
import { randomUUID } from "node:crypto";
import { logApiFailure } from "./logging";
import type { z } from "zod";
import { configured, supabase } from "@/lib/supabase";
import { getConfig } from "@/lib/config";

const codes = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  410: "GONE",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "INVALID_INPUT",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
  503: "SERVICE_UNAVAILABLE",
} as const;
type ErrorStatus = keyof typeof codes;
// Fits the existing 100KB CSV even after JSON escaping; file uploads keep their own limits.
export const MAX_API_JSON_BYTES = 1024 * 1024;

async function boundedBody(request: Request, maxBytes = MAX_API_JSON_BYTES) {
  const announced = request.headers.get("content-length");
  if (announced && /^\d+$/.test(announced) && Number(announced) > maxBytes)
    fail("요청 본문이 너무 큽니다.", 413);
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        fail("요청 본문이 너무 큽니다.", 413);
      }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    fail("요청 본문을 읽을 수 없습니다.", 400);
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

class ApiFailure extends Error {
  constructor(
    message: string,
    readonly status: ErrorStatus,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export function fail(
  message: string,
  status: number = 400,
  retryAfter?: number,
): never {
  throw new ApiFailure(
    message,
    status in codes ? (status as ErrorStatus) : 500,
    retryAfter,
  );
}

// DEV-B handlers retain their route context while sharing the established error/CSRF boundary.
export function compatibleApiRoute<Args extends unknown[]>(
  operation: string,
  handler: (request: Request, ...args: Args) => Promise<Response> | Response,
  options: { maxBodyBytes?: number } = {},
) {
  const limit = options.maxBodyBytes ?? MAX_API_JSON_BYTES;
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 8 * MAX_API_JSON_BYTES
  )
    throw Error("Invalid API body limit");
  return (request: Request, ...args: Args) =>
    apiRoute(operation, async (req) => {
      // Bound every body: trusting a JSON media type would allow a forged type to bypass the limit.
      if (req.body) {
        const bytes = await boundedBody(req, limit);
        // The incoming NextRequest stream has been consumed. Reconstruct the
        // handler's Request from its URL/headers, including the empty-body case.
        req = new Request(req.url, {
          method: req.method,
          headers: req.headers,
          signal: req.signal,
          body: bytes.byteLength ? bytes.buffer : undefined,
        });
      }
      return handler(req, ...args);
    })(request);
}

export function apiRoute(
  operation: string,
  handler: (
    request: Request,
    requestId: string,
  ) => Promise<Response> | Response,
) {
  return async (request: Request) => {
    const requestId = randomUUID();
    const started = performance.now();
    try {
      if (
        request.method !== "GET" &&
        request.method !== "HEAD" &&
        !safeOrigin(request)
      )
        fail("허용되지 않은 요청입니다.", 403);
      const response = await handler(request, requestId);
      const headers = new Headers(response.headers);
      headers.set("X-Request-Id", requestId);
      // Fetch/redirect responses can have immutable headers.
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const status = error instanceof ApiFailure ? error.status : 500;
      const code = codes[status];
      const message =
        error instanceof ApiFailure
          ? error.message
          : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
      if (status >= 500)
        logApiFailure(operation, code, requestId, performance.now() - started);
      return Response.json(
        { error: { message, code, requestId } },
        {
          status,
          headers: {
            "Cache-Control": "no-store",
            "X-Request-Id": requestId,
            ...(status === 429
              ? {
                  "Retry-After": String(
                    error instanceof ApiFailure &&
                      Number.isInteger(error.retryAfter) &&
                      error.retryAfter! > 0 &&
                      error.retryAfter! <= 86400
                      ? error.retryAfter
                      : 60,
                  ),
                }
              : {}),
          },
        },
      );
    }
  };
}

export async function parseBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
  message: string,
): Promise<z.output<Schema>> {
  let input: unknown;
  const bytes = await boundedBody(request);
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(message);
  }
  return parseInput(schema, input, message);
}

export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
  message: string,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) fail(message, 422);
  return result.data;
}

export function failDatabase(
  error: { code: string; details?: string },
  message: string,
): never {
  switch (error.code) {
    case "42501":
      return fail(message, 403);
    case "23503":
    case "23505":
    case "40001":
    case "40P01":
    case "55P03":
      return fail(message, 409);
    case "23514":
    case "22023":
      return fail(message, 422);
    case "P0002":
    case "PT404":
      return fail(message, 404);
    case "54000":
      return fail(message, 429);
    case "PT429": {
      let retry: unknown;
      try {
        retry = JSON.parse(error.details ?? "{}").retryAfter;
      } catch {
        /* No provider text is forwarded. */
      }
      return fail(
        message,
        429,
        typeof retry === "number" &&
          Number.isInteger(retry) &&
          retry > 0 &&
          retry <= 86400
          ? retry
          : 60,
      );
    }
    default:
      return fail(message, 503);
  }
}

export async function context(strict = false) {
  if (!configured()) {
    if (strict) fail("계정 서비스 연결을 준비 중입니다.", 503);
    return null;
  }
  const db = await supabase();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (strict && authError) {
    if (authError.status === 429) fail("잠시 후 다시 시도해주세요.", 429);
    const invalidSession =
      authError.name === "AuthSessionMissingError" ||
      [400, 401, 403, 404].includes(authError.status ?? 0);
    if (!invalidSession) fail("인증 서버에 연결할 수 없습니다.", 503);
    return null;
  }
  if (!user) return null;
  const { data: profile, error } = await db
    .from("profiles")
    .select("role,name")
    .eq("id", user.id)
    .maybeSingle();
  if (strict && error) failDatabase(error, "계정 정보를 불러오지 못했습니다.");
  if (strict && !profile) fail("계정 정보에 접근할 수 없습니다.", 403);
  if (error || !profile) return null;
  return {
    db,
    user,
    role: profile?.role as string | undefined,
    name: profile?.name as string | undefined,
  };
}

export async function requireContext() {
  const result = await context(true);
  if (!result) fail("로그인이 필요합니다.", 401);
  return result;
}

export function requireTestBilling() {
  const { features } = getConfig();
  if (features.testBilling === "off")
    fail("현재 환경에서 TEST 결제를 제공하지 않습니다.", 404);
  if (features.testBilling !== "enabled")
    fail("TEST 결제 연결을 준비 중입니다.", 503);
}

export function requireFeature(feature: "ingestion" | "llm") {
  const state = getConfig().features[feature];
  if (state === "off") fail("현재 제공하지 않는 기능입니다.", 404);
  if (state !== "enabled") fail("서비스 연결을 준비 중입니다.", 503);
}

export function safeOrigin(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (
      url.origin === origin &&
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.host === req.headers.get("host")
    );
  } catch {
    return false;
  }
}
