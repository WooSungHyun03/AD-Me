import { beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/messages/route";
import { POST as BLOCK } from "@/app/api/messages/block/route";
import { POST as REPORT } from "@/app/api/messages/report/route";
import {
  decodeConversationCursor,
  projectConversationPage,
} from "@/lib/conversation-server";
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requireContext: async () => ({
    user: { id: "caller-only" },
    db: { rpc: state.rpc },
  }),
}));
const room = "ad000000-0000-4000-8000-000000000801",
  key = "ad000000-0000-4000-8000-000000000802";
const body = {
  proposalId: room,
  clientKey: key,
  body: "hello",
  kind: "message",
};
const request = (path: string, data: unknown) =>
  new Request(`https://app.example${path}`, {
    method: "POST",
    headers: {
      origin: "https://app.example",
      host: "app.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
beforeEach(() => {
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({ data: key, error: null });
});
it("keeps caller ownership in DB and retry key stable; legacy clients receive a server key", async () => {
  const res = await POST(
    request("/api/messages", { ...body, sender_id: "forged" }),
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, id: key });
  expect(state.rpc).toHaveBeenLastCalledWith("conversation_send", {
    p_proposal: room,
    p_key: key,
    p_body: "hello",
    p_kind: "message",
    p_url: null,
  });
  await POST(request("/api/messages", { ...body, clientKey: undefined }));
  expect(state.rpc.mock.lastCall?.[1].p_key).toMatch(/^[a-f0-9-]{36}$/);
});
it("rejects empty text, unsafe URLs and missing deliverable links before RPC", async () => {
  for (const input of [
    { ...body, body: "  " },
    { ...body, clientKey: "bad" },
    { ...body, kind: "deliverable" },
    { ...body, url: "javascript:alert(1)" },
    { ...body, url: "https://user:pass@example.org/x" },
  ])
    expect((await POST(request("/api/messages", input))).status).toBe(422);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("maps conflicts, membership denial and quota without exposing private DB text", async () => {
  for (const [code, status] of [
    ["23505", 409],
    ["42501", 403],
    ["PT429", 429],
  ] as const) {
    state.rpc.mockResolvedValue({
      data: null,
      error: { code, message: "PRIVATE_MESSAGE", details: '{"retryAfter":17}' },
    });
    const res = await POST(request("/api/messages", body));
    expect(res.status).toBe(status);
    expect(await res.text()).not.toContain("PRIVATE_MESSAGE");
    if (status === 429) expect(res.headers.get("Retry-After")).toBe("17");
  }
});
it("binds opaque microsecond cursor to the requested room and rejects private DTO additions", () => {
  const point = { createdAt: "2026-11-20T01:02:03.123456+00:00", id: key };
  const page = projectConversationPage(
    {
      version: 1,
      items: [],
      nextCursor: point,
      blocked: false,
      blockedByMe: false,
    },
    room,
  );
  expect(decodeConversationCursor(page.nextCursor!, room)).toMatchObject(point);
  expect(() => decodeConversationCursor(page.nextCursor!, key)).toThrow();
  for (const cursor of [
    "!",
    "a".repeat(513),
    Buffer.from("{}").toString("base64url"),
  ])
    expect(() => decodeConversationCursor(cursor, room)).toThrow();
  expect(() =>
    projectConversationPage({ ...page, reporter_id: "private" }, room),
  ).toThrow();
});
it("GET requires a room, bounds reads and returns private no-store data", async () => {
  expect(
    (await GET(new Request("https://app.example/api/messages"))).status,
  ).toBe(422);
  expect(
    (
      await GET(
        new Request(
          `https://app.example/api/messages?proposalId=${room}&limit=51`,
        ),
      )
    ).status,
  ).toBe(422);
  state.rpc.mockResolvedValue({
    data: {
      version: 1,
      items: [],
      nextCursor: null,
      blocked: false,
      blockedByMe: false,
    },
    error: null,
  });
  const res = await GET(
    new Request(`https://app.example/api/messages?proposalId=${room}&limit=5`),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  expect(state.rpc).toHaveBeenLastCalledWith("conversation_page", {
    p_proposal: room,
    p_before_at: null,
    p_before_id: null,
    p_limit: 5,
  });
});
it("keeps legacy history readable while dropping oversized or credential-bearing optional links", () => {
  for (const url of [
    "https://example.org/" + "a".repeat(1001),
    "https://user:secret@example.org/file",
  ]) {
    const page = projectConversationPage(
      {
        version: 1,
        items: [
          {
            id: key,
            senderId: room,
            body: "legacy body",
            kind: "message",
            url,
            createdAt: "2026-11-20T01:00:00Z",
          },
        ],
        nextCursor: null,
        blocked: false,
        blockedByMe: false,
      },
      room,
    );
    expect(page.items[0].url).toBeNull();
    expect(page.items[0].body).toBe("legacy body");
  }
});
it("requires explicit own block state and a bounded private report reason", async () => {
  state.rpc.mockResolvedValue({ data: true, error: null });
  expect(
    (
      await BLOCK(
        request("/api/messages/block", { proposalId: room, blocked: true }),
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await BLOCK(
        request("/api/messages/block", { proposalId: room, blocked: "true" }),
      )
    ).status,
  ).toBe(422);
  expect(
    (
      await REPORT(
        request("/api/messages/report", { messageId: key, reason: "짧음" }),
      )
    ).status,
  ).toBe(422);
  state.rpc.mockResolvedValue({ data: key, error: null });
  expect(
    (
      await REPORT(
        request("/api/messages/report", {
          messageId: key,
          reason: "비공개 검토를 요청하는 가상 사유입니다.",
        }),
      )
    ).status,
  ).toBe(200);
  expect(state.rpc).toHaveBeenLastCalledWith("conversation_report", {
    p_message: key,
    p_reason: "비공개 검토를 요청하는 가상 사유입니다.",
  });
});
