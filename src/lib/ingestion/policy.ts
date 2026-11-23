// Executable twin of docs/data-sources/README.md. A source runs only when every gate here passes,
// and the check happens before any network fetch.
export type SourceId =
  | "owner_self_registration"
  | "youtube_data_api"
  | "tiktok_display_api"
  | "demo_fixture";
export type SourcePolicy = {
  id: SourceId;
  purpose: string;
  legal_basis: string;
  fields: readonly string[];
  terms_url: string | null;
  terms_version: string | null; // recorded by the reviewer from the provider page, never guessed
  retention_days: number;
  refresh_days: number | null;
  redistribution: "public_profile" | "internal_only" | "none";
  reviewer: string | null;
  status: "approved" | "pending" | "rejected" | "expired";
  review_expires_at: string | null; // ISO date
};
export const policies: Record<SourceId, SourcePolicy> = {
  owner_self_registration: {
    id: "owner_self_registration",
    purpose: "크리에이터 본인이 입력한 협업 프로필 공개",
    legal_basis: "본인 입력·공개 동의(owner_consent)",
    fields: [
      "name",
      "bio",
      "categories",
      "vibes",
      "formats",
      "platforms",
      "price_min_krw",
      "price_max_krw",
      "is_available",
      "social_url",
      "portfolio_url",
    ],
    terms_url: null,
    terms_version: "AD Me 개인정보 처리방침(/privacy)",
    retention_days: 365,
    refresh_days: null,
    redistribution: "public_profile",
    reviewer: "AD Me 운영",
    status: "approved",
    review_expires_at: null,
  },
  youtube_data_api: {
    id: "youtube_data_api",
    purpose: "허용 seed 채널의 공개 프로필·공개 통계 표시",
    legal_basis:
      "YouTube API Services 약관에 따른 공개 데이터 조회 (U001 검토 필요)",
    fields: [
      "channel_id",
      "title",
      "description",
      "custom_url",
      "published_at",
      "country",
      "subscriber_count",
      "hidden_subscriber_count",
      "video_count",
      "view_count",
      "video_id",
      "video_title",
      "video_published_at",
      "video_view_count",
      "video_like_count",
      "video_comment_count",
    ],
    terms_url:
      "https://developers.google.com/youtube/terms/api-services-terms-of-service",
    terms_version: null,
    retention_days: 30,
    refresh_days: 30,
    redistribution: "public_profile",
    reviewer: null,
    status: "pending",
    review_expires_at: null,
  },
  tiktok_display_api: {
    id: "tiktok_display_api",
    purpose:
      "동의한 크리에이터 본인 계정 정보·콘텐츠 연결 (Research API 사용 금지)",
    legal_basis: "계정 소유자 OAuth 동의 (U013 승인 필요)",
    fields: [
      "open_id",
      "display_name",
      "avatar_url",
      "follower_count",
      "video_id",
      "video_title",
      "video_view_count",
    ],
    terms_url:
      "https://www.tiktok.com/legal/page/global/tik-tok-developer-terms-of-service/en",
    terms_version: null,
    retention_days: 30,
    refresh_days: 30,
    redistribution: "public_profile",
    reviewer: null,
    status: "pending",
    review_expires_at: null,
  },
  demo_fixture: {
    id: "demo_fixture",
    purpose: "TEST 시연용 가상 데이터",
    legal_basis: "자체 생성 가상 데이터",
    fields: ["*"],
    terms_url: null,
    terms_version: "fixtures/",
    retention_days: 3650,
    refresh_days: null,
    redistribution: "none",
    reviewer: "AD Me 운영",
    status: "approved",
    review_expires_at: null,
  },
};
export class SourceNotAllowedError extends Error {}
export function assertSourceAllowed(
  id: string,
  now = new Date(),
  table: Record<string, SourcePolicy> = policies,
): SourcePolicy {
  const p = table[id];
  if (!p) throw new SourceNotAllowedError(`등록되지 않은 공급원: ${id}`);
  if (p.status !== "approved")
    throw new SourceNotAllowedError(
      `승인되지 않은 공급원: ${id} (${p.status})`,
    );
  if (!p.reviewer || !p.terms_version)
    throw new SourceNotAllowedError(`검토자·약관 버전 미기록: ${id}`);
  if (p.review_expires_at && new Date(p.review_expires_at) <= now)
    throw new SourceNotAllowedError(`정책 검토 만료: ${id}`);
  return p;
}
// Drops every field not on the allowlist so unreviewed data never reaches storage.
export function pickAllowed(p: SourcePolicy, raw: Record<string, unknown>) {
  if (p.fields.includes("*")) return { ...raw };
  return Object.fromEntries(
    Object.entries(raw).filter(([k]) => p.fields.includes(k)),
  );
}
