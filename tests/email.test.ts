import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  render,
  runOutbox,
  TEMPLATES,
  type Claimed,
  type Sender,
} from "@/lib/notifications/email";
import type { SupabaseClient } from "@supabase/supabase-js";

const row = (o: Partial<Claimed> = {}): Claimed => ({
  id: 7,
  purpose: "marketing",
  template: "marketing",
  template_version: "v1",
  source_key: "marketing:nov",
  email: "user@example.test",
  attempts: 1,
  unsubscribe: "u.marketing.abc",
  ...o,
});
const stub = (rows: Claimed[]) => {
  const calls: [string, unknown][] = [];
  const svc = {
    rpc: vi.fn(
      async (fn: string, args: unknown) => (
        calls.push([fn, args]),
        fn === "claim_emails"
          ? { data: rows, error: null }
          : { data: "sent", error: null }
      ),
    ),
  };
  return { svc: svc as unknown as SupabaseClient, calls };
};

describe("notification email (D053)", () => {
  it("renders versioned copy with one-click unsubscribe and an idempotency key", () => {
    const m = render(row(), "https://app.test");
    expect(m.subject).toContain("광고");
    expect(m.text).toContain("https://app.test/unsubscribe?t=u.marketing.abc");
    expect(m.headers).toEqual({
      "List-Unsubscribe": "<https://app.test/unsubscribe?t=u.marketing.abc>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(m.idempotencyKey).toBe("adme-marketing:nov-7");
    expect(() => render(row({ template_version: "v9" }), "x")).toThrow(
      "unknown_template",
    );
  });
  it("has copy for every template the database can enqueue", () => {
    const kinds = readFileSync(
      "supabase/migrations/20261123100010_notifications.sql",
      "utf8",
    ).match(/kind in \(([^)]*)\)/)![1];
    for (const k of kinds.match(/[a-z]+/g)!)
      expect(TEMPLATES[`notification_${k}`]?.v1).toBeDefined();
    expect(TEMPLATES.marketing.v1).toBeDefined();
  });
  it("without a sender nothing is claimed or marked sent", async () => {
    const { svc, calls } = stub([row()]);
    expect(await runOutbox(svc, null, "x")).toMatchObject({
      blocked: "메일 발송 공급자 미설정",
      sent: 0,
    });
    expect(calls).toEqual([]);
  });
  it("reports success and failure per row to finish_email", async () => {
    const { svc, calls } = stub([row({ id: 1 }), row({ id: 2 })]);
    const sender: Sender = {
      name: "fake",
      send: async (m) => {
        if (m.idempotencyKey.endsWith("-2")) throw new Error("smtp_421");
      },
    };
    expect(await runOutbox(svc, sender, "https://app.test")).toMatchObject({
      claimed: 2,
      sent: 1,
      failed: 1,
    });
    expect(calls.slice(1)).toEqual([
      ["finish_email", { p_id: 1, p_ok: true, p_error: null }],
      ["finish_email", { p_id: 2, p_ok: false, p_error: "smtp_421" }],
    ]);
  });
  it("D078: stored provider errors never keep addresses or credentials", async () => {
    const { svc, calls } = stub([row({ id: 3 })]);
    const key = ["Bearer ", "Z".repeat(30)].join("");
    const sender: Sender = {
      name: "fake",
      send: async () => {
        throw new Error(`rejected to=kim@example.com auth ${key}`);
      },
    };
    await runOutbox(svc, sender, "https://app.test");
    const stored = JSON.stringify(calls.slice(1));
    expect(stored).not.toContain("kim@example.com");
    expect(stored).not.toContain("Z".repeat(30));
    expect(stored).toContain("[email]");
  });
});
