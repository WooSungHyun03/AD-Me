import { beforeEach, expect, it, vi } from "vitest";
import { GET, POST, PATCH } from "@/app/api/campaigns/[id]/brief/route";
const f = vi.hoisted(() => ({
  role: "brand",
  rpc: vi.fn(),
  adminRpc: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
}));
const actor = "00000000-0000-4000-8000-000000000001",
  campaign = "00000000-0000-4000-8000-000000000042",
  key = "00000000-0000-4000-8000-000000000043";
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requireContext: async () => ({
    role: f.role,
    user: { id: actor },
    db: { rpc: f.rpc },
  }),
}));
vi.mock("@/lib/uploads", async (original) => ({
  ...(await original<typeof import("@/lib/uploads")>()),
  storageAdmin: () => ({
    rpc: f.adminRpc,
    storage: {
      from: () => ({
        upload: f.upload,
        download: f.download,
        remove: f.remove,
      }),
    },
  }),
}));
const page = {
  version: 1,
  enabled: true,
  revision: 0,
  activeFile: null,
  history: [],
  files: [],
};
const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ctx = () => ({ params: Promise.resolve({ id: campaign }) });
function request(
  mime = "image/png",
  content = bytes,
  fields: Record<string, string> = {},
) {
  const form = new FormData();
  form.set("file", new File([content], "fictional.png", { type: mime }));
  for (const [name, value] of Object.entries({
    rights: "on",
    clientKey: key,
    expectedVersion: "0",
    ...fields,
  }))
    form.set(name, value);
  return new Request(
    "https://example.test/api/campaigns/" + campaign + "/brief",
    { method: "POST", body: form },
  );
}
const json = (body: unknown) =>
  new Request("https://example.test/api/campaigns/" + campaign + "/brief", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  f.role = "brand";
  f.rpc.mockImplementation(async (name) =>
    name === "campaign_brief_page"
      ? { data: page, error: null }
      : { data: null, error: null },
  );
  f.adminRpc.mockResolvedValue({
    data: { revision: 1, fileId: key },
    error: null,
  });
  f.upload.mockResolvedValue({ data: {}, error: null });
  f.remove.mockResolvedValue({ error: null });
});
it("opposite role, foreign campaign and policy-off requests stop before file writes", async () => {
  f.role = "creator";
  expect((await POST(request(), ctx())).status).toBe(403);
  expect(f.rpc).not.toHaveBeenCalled();
  f.role = "brand";
  f.rpc.mockResolvedValue({
    data: null,
    error: { code: "P0002", message: "PRIVATE-BRIEF" },
  });
  expect((await POST(request(), ctx())).status).toBe(404);
  f.rpc.mockResolvedValue({ data: { ...page, enabled: false }, error: null });
  expect((await POST(request(), ctx())).status).toBe(503);
  expect(f.upload).not.toHaveBeenCalled();
});
it("rejects missing rights, missing version, forged media and oversized bodies before storage", async () => {
  expect(
    (await POST(request("image/png", bytes, { rights: "" }), ctx())).status,
  ).toBe(422);
  expect(
    (await POST(request("image/png", bytes, { expectedVersion: "" }), ctx()))
      .status,
  ).toBe(422);
  expect(
    (
      await POST(
        request("image/png", new TextEncoder().encode("<script>evil</script>")),
        ctx(),
      )
    ).status,
  ).toBe(415);
  const oversized = new Request(
    "https://example.test/api/campaigns/" + campaign + "/brief",
    { method: "POST", body: "x", headers: { "content-length": "5000000" } },
  );
  expect((await POST(oversized, ctx())).status).toBe(413);
  expect(f.upload).not.toHaveBeenCalled();
});
it("binds verified immutable bytes and actor to a bounded service-only commit and minimal receipt", async () => {
  const response = await POST(request(), ctx());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ revision: 1, fileId: key });
  expect(f.upload).toHaveBeenCalledWith(`${campaign}/${key}.png`, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  expect(f.adminRpc).toHaveBeenCalledWith(
    "campaign_brief_change",
    expect.objectContaining({
      p_actor: actor,
      p_campaign: campaign,
      p_expected: 0,
      p_file: key,
      p_key: key,
      p_metadata: expect.objectContaining({
        size: 8,
        mime: "image/png",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    }),
  );
});
it("same-key receipt avoids another object write and changed replay is a conflict", async () => {
  f.rpc.mockImplementation(async (name) => ({
    data: name === "campaign_brief_page" ? page : { revision: 1, fileId: key },
    error: null,
  }));
  expect((await POST(request(), ctx())).status).toBe(200);
  expect(f.upload).not.toHaveBeenCalled();
  f.rpc.mockImplementation(async (name) =>
    name === "campaign_brief_page"
      ? { data: page, error: null }
      : { data: null, error: { code: "23505" } },
  );
  expect((await POST(request(), ctx())).status).toBe(409);
  expect(f.adminRpc).not.toHaveBeenCalled();
});
it("rejects a known stale version before an external object write while retaining same-key recovery", async () => {
  expect(
    (await POST(request("image/png", bytes, { expectedVersion: "1" }), ctx()))
      .status,
  ).toBe(409);
  expect(f.upload).not.toHaveBeenCalled();
  expect(f.adminRpc).not.toHaveBeenCalled();
});
it("lost commit acknowledgement returns the stored receipt without deleting a committed object", async () => {
  let retries = 0;
  f.rpc.mockImplementation(async (name) => ({
    data:
      name === "campaign_brief_page"
        ? page
        : ++retries > 1
          ? { revision: 1, fileId: key }
          : null,
    error: null,
  }));
  f.adminRpc.mockResolvedValue({ data: null, error: { code: "FETCH_ERROR" } });
  expect((await POST(request(), ctx())).status).toBe(200);
  expect(f.remove).not.toHaveBeenCalled();
});
it("unknown commit outcome preserves content; only a confirmed rejected transaction is cleaned", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  f.adminRpc.mockResolvedValue({ data: null, error: { code: "FETCH_ERROR" } });
  expect((await POST(request(), ctx())).status).toBe(503);
  expect(f.remove).not.toHaveBeenCalled();
  f.adminRpc.mockResolvedValue({ data: null, error: { code: "40001" } });
  expect((await POST(request(), ctx())).status).toBe(409);
  expect(f.remove).toHaveBeenCalledWith([`${campaign}/${key}.png`]);
  spy.mockRestore();
});
it("recovers byte-identical uploaded content without overwrite and refuses conflicting bytes", async () => {
  f.upload.mockResolvedValue({ error: { statusCode: "409" } });
  f.download.mockResolvedValue({ data: new Blob([bytes]), error: null });
  expect((await POST(request(), ctx())).status).toBe(200);
  f.adminRpc.mockClear();
  f.download.mockResolvedValue({
    data: new Blob([new Uint8Array(8)]),
    error: null,
  });
  expect((await POST(request(), ctx())).status).toBe(409);
  expect(f.adminRpc).not.toHaveBeenCalled();
  expect(f.remove).not.toHaveBeenCalled();
});
it("keeps history private/no-store and allows a policy-off clear but not new restoration", async () => {
  const response = await GET(new Request("https://example.test"), ctx());
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual(page);
  f.rpc.mockResolvedValue({ data: { ...page, enabled: false }, error: null });
  expect(
    (
      await PATCH(
        json({
          action: "clear",
          fileId: null,
          expectedVersion: 0,
          clientKey: key,
        }),
        ctx(),
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await PATCH(
        json({
          action: "restore",
          fileId: key,
          expectedVersion: 0,
          clientKey: key,
        }),
        ctx(),
      )
    ).status,
  ).toBe(503);
  expect(
    (
      await PATCH(
        json({
          action: "clear",
          fileId: key,
          expectedVersion: 0,
          clientKey: key,
        }),
        ctx(),
      )
    ).status,
  ).toBe(422);
});
