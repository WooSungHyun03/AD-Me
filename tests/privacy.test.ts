import { describe, expect, it } from "vitest";
import {
  assertClean,
  counterpartIds,
  sanitizeExport,
  type RawExport,
} from "../src/lib/privacy";
const me = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";
const raw = (): RawExport => ({
  account: { email: "me@example.com" },
  profile: { name: "나" },
  creator: null,
  campaigns: [],
  proposals: [
    {
      id: "p1",
      kind: "proposal",
      brand_id: other,
      creator_user_id: me,
      brief: "상대 비공개 브리프",
      status: "accepted",
    },
    {
      id: "p2",
      kind: "application",
      brand_id: other,
      creator_user_id: me,
      brief: "내 지원서",
      status: "pending",
    },
  ],
  messages: [
    { id: "m1", sender_id: me, body: "내 메시지" },
    { id: "m2", sender_id: other, body: "상대 비밀 메시지" },
  ],
  proposal_events: [
    {
      proposal_id: "p1",
      actor_id: other,
      recipient_id: me,
      to_status: "accepted",
    },
  ],
  saved_lists: [],
  saved_list_items: [],
  reports: [{ id: "r1", decided_by: other, response: "답변" }],
  report_events: [],
  claims: [],
  orders: [{ id: "o1", payment_key: "tgen_secret", amount: 1000 }],
  entitlements: [],
  notifications: [],
  privacy_access_log: [],
  uploads: [],
  notes: [],
  compare_reports: [],
  consent_log: [],
  matching_feedback: [],
  ai_usage: [],
  review_checklist_items: [],
  creator_reviews: [],
  inquiries: [],
  credit_ledger: [],
});
describe("D074 personal data export", () => {
  it("keeps own data, drops counterpart content, ids and secret fields", () => {
    const r = raw();
    const out = sanitizeExport(r, me);
    const text = JSON.stringify(out);
    expect(text).toContain("내 메시지");
    expect(text).toContain("내 지원서");
    expect(text).not.toContain("상대 비밀 메시지");
    expect(text).not.toContain("상대 비공개 브리프");
    expect(text).not.toContain(other);
    expect(text).not.toContain("tgen_secret");
    expect(text).not.toContain("decided_by");
    expect((out.proposal_events as { actor: string }[])[0].actor).toBe(
      "counterparty",
    );
    expect(() => assertClean(out, counterpartIds(r, me))).not.toThrow();
  });
  it("guard rejects unsanitized data", () => {
    const r = raw();
    expect(() => assertClean(r, counterpartIds(r, me))).toThrow(
      /export_unsafe/,
    );
    expect(() => assertClean({ x: other }, [other])).toThrow(
      "export_unsafe:foreign_id",
    );
  });
});
