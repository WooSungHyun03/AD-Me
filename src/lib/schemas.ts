import { z } from "zod";
import { categories, vibes, formats, platforms } from "./catalog";
const pick = (list: readonly string[], max: number) =>
  z
    .array(z.enum(list as [string, ...string[]]))
    .min(1)
    .max(max)
    .refine((a) => new Set(a).size === a.length, "중복 선택");
const krw = z.number().int().min(0).max(100000000).nullable();
export const campaignSchema = z.object({
  title: z.string().trim().min(2).max(120),
  product: z.string().trim().min(1).max(120),
  category: z.string().min(1).max(50),
  vibes: z.array(z.string().max(30)).min(1).max(8),
  format: z.string().min(1).max(40),
  platforms: z.array(z.enum(["instagram", "youtube", "tiktok"])).min(1),
  budget_krw: z.number().int().min(10000).max(100000000),
  target_audience: z.string().min(2).max(500),
  goal: z.string().min(2).max(500),
  status: z.enum(["draft", "published", "closed"]),
  // Stored as campaign columns, not in the brief. Deadline is checked against the DB clock.
  recruit_until: z.iso.datetime({ offset: true }).nullable().optional(),
  capacity: z.number().int().min(1).max(100).nullable().optional(),
  // D044 matching policy, stored in the brief.
  policy: z
    .object({
      category: z.enum(["hard", "soft"]),
      budget: z.enum(["hard", "soft"]),
      unknown: z.enum(["exclude", "hold"]),
    })
    .partial()
    .optional(),
});
// DB rule codes (20261123100007_campaign_recruiting.sql) → user messages.
export const recruitingErrors: Record<string, string> = {
  deadline_passed: "모집 마감일은 현재 시각 이후여야 합니다.",
  invalid_transition: "현재 상태에서 바꿀 수 없는 공개 상태입니다.",
  invalid_status: "새 캠페인은 초안 또는 공개 모집으로만 만들 수 있습니다.",
  has_active_proposals:
    "진행 중인 제안·지원이 있어 비공개로 바꿀 수 없습니다. 모집 마감을 이용하세요.",
  capacity_below_selected: "선정 인원보다 적게 모집 인원을 줄일 수 없습니다.",
  capacity_full: "모집 인원이 모두 선정되었습니다.",
  creator_unavailable:
    "크리에이터 프로필이 비공개이거나 본인 확인이 해제되어 협업을 시작할 수 없습니다.",
  // Same wording whoever blocked whom, so a block is never revealed to the blocked person.
  blocked: "이 상대와는 더 이상 연락할 수 없습니다.",
  contact_restricted:
    "운영 검토로 연락이 일시 제한된 계정입니다. 대시보드에서 기한과 이의신청 방법을 확인하세요.",
  rate_limited: "짧은 시간에 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  review_required:
    "선정 전 검토 체크리스트를 모두 확인하고 승인해야 합니다. 캠페인 화면의 선정 검토에서 진행하세요.",
};
export const reportKinds: Record<string, string> = {
  report: "신고",
  correction: "정보 정정",
  deletion: "삭제 요청",
  impersonation: "사칭 신고",
  appeal: "재심 요청",
};
export const reportStatuses: Record<string, string> = {
  pending: "접수",
  in_review: "검토 중",
  resolved: "처리 완료",
  dismissed: "반려",
};
const reportErrors: Record<string, string> = {
  rate_limited: "24시간 동안 접수할 수 있는 요청 수(5건)를 넘었습니다.",
  duplicate_open: "같은 대상에 대해 처리 중인 요청이 이미 있습니다.",
  appeal_closed:
    "재심은 처리 결과가 나온 뒤 30일 안에 한 번만 요청할 수 있습니다.",
  invalid_source: "확인 가능한 HTTPS 출처를 입력해주세요.",
  not_found: "대상 프로필을 찾을 수 없습니다.",
  response_required:
    "처리 완료·반려 시 요청자에게 보낼 답변(5자 이상)이 필요합니다.",
  same_reviewer: "재심은 원 처리자가 아닌 다른 관리자가 처리해야 합니다.",
  invalid_transition: "현재 상태에서 할 수 없는 처리입니다.",
};
export const reportError = (msg = "") =>
  Object.entries(reportErrors).find(([k]) => msg.includes(k))?.[1];
export const recruitingError = (msg = "") =>
  Object.entries(recruitingErrors).find(([k]) => msg.includes(k))?.[1];
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    bio: z.string().max(1000),
    social_url: z
      .union([
        z.literal(""),
        z
          .url()
          .max(1000)
          .refine((v) => v.startsWith("https://")),
      ])
      .optional(),
    portfolio_url: z
      .union([
        z.literal(""),
        z
          .url()
          .max(1000)
          .refine((v) => v.startsWith("https://")),
      ])
      .optional(),
    owner_consent: z.boolean().default(false),
    categories: pick(categories, 5),
    vibes: pick(vibes, 8),
    formats: pick(formats, 8),
    platforms: pick(platforms, 3),
    price_min_krw: krw, // null = 견적 미확인
    price_max_krw: krw,
    is_available: z.boolean().nullable(), // null = 협업 의사 미확인
    published: z.boolean(),
  })
  .refine(
    (d) =>
      !d.published || (!d.social_url && !d.portfolio_url) || d.owner_consent,
    { message: "공개 링크의 권리·공개 동의를 확인해주세요." },
  )
  .refine(
    (d) =>
      (d.price_min_krw === null) === (d.price_max_krw === null) &&
      (d.price_min_krw === null || d.price_max_krw! >= d.price_min_krw),
    {
      message:
        "견적은 최소·최대를 함께 입력하거나 둘 다 미확인으로 두세요. 최대는 최소 이상이어야 합니다.",
    },
  );
export const proposalSchema = z.object({
  campaignId: z.uuid(),
  creatorId: z.string().min(1).max(100),
  brief: z.string().trim().min(10).max(3000),
  kind: z.enum(["proposal", "application"]),
});
export function canTransition(
  kind: string,
  state: string,
  action: string,
  role: string,
) {
  const start = kind === "application" ? "brand" : "creator";
  return (
    (state === "pending" &&
      ["accepted", "rejected"].includes(action) &&
      role === start) ||
    // the side that started the request may withdraw it while it is pending
    (state === "pending" && action === "cancelled" && role !== start) ||
    (state === "accepted" && action === "submitted" && role === "creator") ||
    (state === "submitted" &&
      ["completed", "revision_requested"].includes(action) &&
      role === "brand") ||
    (state === "revision_requested" &&
      action === "submitted" &&
      role === "creator")
  );
}
// D063: help/contact categories (must match the inquiries.category check).
export const inquiryCategories = {
  usage: "이용 방법",
  account: "계정·로그인",
  data: "데이터·정정",
  billing: "TEST 결제",
  other: "기타",
} as const;
