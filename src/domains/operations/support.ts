import { z } from "zod";
export const supportKinds = [
  "members",
  "creators",
  "campaigns",
  "jobs",
  "reports",
  "orders",
  "audit",
] as const;
export const supportLabels: Record<(typeof supportKinds)[number], string> = {
  members: "회원",
  creators: "크리에이터",
  campaigns: "캠페인",
  jobs: "수집 작업",
  reports: "신고·정정·삭제 요청",
  orders: "TEST 주문",
  audit: "지원 감사 기록",
};
export const supportScopes: Record<
  string,
  readonly (typeof supportKinds)[number][]
> = {
  super: supportKinds,
  support: ["members", "reports"],
  content: ["creators", "jobs"],
  campaign: ["campaigns"],
  finance: ["orders"],
};
const kind = z.enum(supportKinds);
export const supportCursorSchema = z.strictObject({
  kind,
  query: z.string().max(100),
  at: z.iso.datetime({ offset: true }),
  id: z.string().min(1).max(100),
});
export const supportInputSchema = z.strictObject({
  kind,
  query: z.string().trim().max(100).default(""),
  cursor: supportCursorSchema.nullable().default(null),
  reason: z.string().trim().min(5).max(500),
});
const details = z.strictObject({
  role: z.enum(["admin", "brand", "creator"]).optional(),
  moderation: z.enum(["allowed", "restricted"]).optional(),
  published: z.boolean().optional(),
  isDemo: z.boolean().optional(),
  attempts: z.number().int().nonnegative().optional(),
  amount: z.number().int().positive().optional(),
  test: z.literal(true).optional(),
  actor: z.uuid().optional(),
  target: z.string().max(160).optional(),
  requestId: z.uuid().optional(),
  reason: z.string().max(500).optional(),
  // D058 request queue rows: ticket, kind, deadline and interim hide only (no reason text or ids).
  ticketNo: z.string().max(40).optional(),
  requestKind: z
    .enum(["report", "correction", "deletion", "impersonation", "appeal"])
    .optional(),
  dueAt: z.iso.datetime({ offset: true }).optional(),
  interimHidden: z.boolean().optional(),
});
export const supportPageSchema = z.strictObject({
  version: z.literal(1),
  kind,
  items: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(100),
        label: z.string().max(100),
        status: z.string().max(80),
        createdAt: z.iso.datetime({ offset: true }),
        details,
      }),
    )
    .max(50),
  nextCursor: supportCursorSchema.nullable(),
});
