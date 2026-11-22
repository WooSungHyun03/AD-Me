import type { SupabaseClient, User } from "@supabase/supabase-js";
// Keys that must never leave the server in a personal data export.
export const FORBIDDEN_KEYS = [
  "payment_key",
  "token_hash",
  "code_hash",
  "decided_by",
  "reviewed_by",
  "service_role",
];
type Row = Record<string, unknown>;
export type RawExport = {
  account: Row;
  profile: Row | null;
  creator: Row | null;
  campaigns: Row[];
  proposals: Row[];
  messages: Row[];
  proposal_events: Row[];
  saved_lists: Row[];
  saved_list_items: Row[];
  reports: Row[];
  report_events: Row[];
  claims: Row[];
  orders: Row[];
  entitlements: Row[];
  notifications: Row[];
  privacy_access_log: Row[];
  uploads: Row[];
  notes: Row[];
  compare_reports: Row[];
  consent_log: Row[];
  matching_feedback: Row[];
  ai_usage: Row[];
  review_checklist_items: Row[];
  creator_reviews: Row[];
  inquiries: Row[];
  credit_ledger: Row[];
};
const strip = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(strip)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.entries(v)
            .filter(([k]) => !FORBIDDEN_KEYS.includes(k))
            .map(([k, x]) => [k, strip(x)]),
        )
      : v;
// Own data only: the other party's identifiers, messages and authored text in a shared collaboration are removed.
export function sanitizeExport(raw: RawExport, uid: string) {
  const who = (id: unknown) =>
    id === uid ? "me" : id == null ? null : "counterparty";
  const proposals = raw.proposals.map(
    ({ brand_id, creator_user_id, brief, ...p }) => {
      const author = p.kind === "proposal" ? brand_id : creator_user_id;
      return {
        ...p,
        my_role: brand_id === uid ? "brand" : "creator",
        brief: author === uid ? brief : "[상대방이 작성한 내용은 제외됨]",
      };
    },
  );
  const messages = raw.messages.filter((m) => m.sender_id === uid);
  const proposal_events = raw.proposal_events.map(
    ({ actor_id, recipient_id, ...e }) => ({
      ...e,
      actor: who(actor_id),
      recipient: who(recipient_id),
    }),
  );
  return strip({
    format: "adme-personal-data-export/1",
    generated_at: new Date().toISOString(),
    notice:
      "본인 계정의 데이터만 포함됩니다. 협업 상대방이 작성한 메시지·제안 내용과 식별자, 결제 키 등 보안 값은 제외했습니다.",
    ...raw,
    proposals,
    messages,
    proposal_events,
  }) as Row;
}
// Fails if a security value or another person's account id would be exported.
export function assertClean(data: unknown, foreignIds: string[]) {
  const text = JSON.stringify(data);
  for (const k of FORBIDDEN_KEYS)
    if (text.includes(`"${k}"`)) throw new Error(`export_unsafe:${k}`);
  // Exact-value match: public creator ids ("user-<uuid>") are public profile URLs, not account ids.
  for (const id of foreignIds)
    if (text.includes(`"${id}"`)) throw new Error("export_unsafe:foreign_id");
}
export const counterpartIds = (raw: RawExport, uid: string) => [
  ...new Set(
    raw.proposals
      .flatMap((p) => [p.brand_id, p.creator_user_id])
      .concat(raw.proposal_events.flatMap((e) => [e.actor_id, e.recipient_id]))
      .filter((id): id is string => typeof id === "string" && id !== uid),
  ),
];
// Every query runs as the signed-in user, so RLS already limits rows to what the user may see.
export async function collectExport(
  db: SupabaseClient,
  user: User,
): Promise<RawExport> {
  const q = async <T extends Row>(
    p: PromiseLike<{ data: T[] | T | null; error: unknown }>,
  ) => {
    const { data, error } = await p;
    if (error) throw new Error("export_query_failed");
    return data;
  };
  const uid = user.id;
  const [
    profile,
    creator,
    campaigns,
    proposals,
    messages,
    proposal_events,
    saved_lists,
    saved_list_items,
    reports,
    report_events,
    claims,
    orders,
    entitlements,
    notifications,
    privacy_access_log,
    uploads,
    notes,
    compare_reports,
    consent_log,
    matching_feedback,
    ai_usage,
    review_checklist_items,
    creator_reviews,
    inquiries,
    credit_ledger,
  ] = await Promise.all([
    q(
      db
        .from("profiles")
        .select(
          "name,role,created_at,service_email,marketing_email,marketing_version,marketing_at,interests,analytics_opt_out",
        )
        .eq("id", uid)
        .maybeSingle(),
    ),
    q(
      db
        .from("creators")
        .select("id,published,claim_status,profile,created_at")
        .eq("owner_id", uid)
        .maybeSingle(),
    ),
    q(
      db
        .from("campaigns")
        .select("id,brief,status,recruit_until,capacity,created_at")
        .eq("owner_id", uid),
    ),
    q(
      db
        .from("proposals")
        .select(
          "id,campaign_id,kind,status,brief,brand_id,creator_user_id,created_at,updated_at",
        )
        .or(`brand_id.eq.${uid},creator_user_id.eq.${uid}`),
    ),
    q(
      db
        .from("messages")
        .select("id,proposal_id,sender_id,kind,body,url,created_at")
        .eq("sender_id", uid),
    ),
    q(
      db
        .from("proposal_events")
        .select(
          "proposal_id,actor_id,recipient_id,from_status,to_status,created_at",
        ),
    ),
    q(
      db
        .from("saved_lists")
        .select("id,name,campaign_id,is_default,created_at")
        .eq("owner_id", uid),
    ),
    q(
      db
        .from("saved_list_items")
        .select("list_id,creator_id,created_at")
        .eq("owner_id", uid),
    ),
    q(
      db
        .from("reports")
        .select(
          "id,ticket_no,kind,creator_id,reason,source_url,status,due_at,interim_hidden,response,decided_at,parent_id,created_at",
        )
        .eq("reporter_id", uid),
    ),
    q(db.from("report_events").select("report_id,to_status,created_at")),
    q(
      db
        .from("creator_claims")
        .select("creator_id,method,status,created_at,reviewed_at")
        .eq("claimant_id", uid),
    ),
    q(
      db
        .from("orders")
        .select("id,sku,amount,status,created_at,paid_at")
        .eq("owner_id", uid),
    ),
    q(
      db
        .from("entitlements")
        .select("id,sku,starts_at,expires_at,credits,grant_reason,revoked_at")
        .eq("owner_id", uid),
    ),
    q(
      db
        .from("notifications")
        .select("proposal_id,kind,status,created_at")
        .eq("user_id", uid),
    ),
    q(
      db
        .from("privacy_access_log")
        .select("action,created_at")
        .eq("user_id", uid),
    ),
    q(
      db
        .from("uploads")
        .select("id,original_name,mime,size_bytes,purpose,created_at")
        .eq("owner_id", uid),
    ),
    q(
      db
        .from("creator_notes")
        .select("creator_id,body,updated_at")
        .eq("owner_id", uid),
    ),
    // Share tokens are left out: the export file must not work as a live share link.
    q(
      db
        .from("compare_reports")
        .select("title,creator_ids,share,created_at")
        .eq("owner_id", uid),
    ),
    q(
      db
        .from("consent_log")
        .select("purpose,value,version,created_at")
        .eq("user_id", uid),
    ),
    q(
      db
        .from("matching_feedback")
        .select(
          "campaign_id,creator_id,model_version,verdict,reason,created_at",
        )
        .eq("rater_id", uid),
    ),
    q(
      db
        .from("ai_usage")
        .select("day,calls,input_tokens,output_tokens")
        .eq("user_id", uid),
    ),
    q(
      db
        .from("review_checklist_items")
        .select("label,created_at")
        .eq("brand_id", uid),
    ),
    // reviewed_by is always the brand itself; checked item ids are internal.
    q(
      db
        .from("creator_reviews")
        .select("campaign_id,creator_id,memo,approved,reviewed_at,updated_at")
        .eq("brand_id", uid),
    ),
    q(
      db
        .from("inquiries")
        .select("category,message,status,answer,answered_at,created_at")
        .eq("user_id", uid),
    ),
    // actor_id (the granting admin) is left out.
    q(
      db
        .from("credit_ledger")
        .select("entitlement_id,kind,delta,balance,note,created_at")
        .eq("owner_id", uid),
    ),
  ]);
  return {
    account: {
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    },
    profile: profile as Row | null,
    creator: creator as Row | null,
    campaigns: (campaigns ?? []) as Row[],
    proposals: (proposals ?? []) as Row[],
    messages: (messages ?? []) as Row[],
    proposal_events: (proposal_events ?? []) as Row[],
    saved_lists: (saved_lists ?? []) as Row[],
    saved_list_items: (saved_list_items ?? []) as Row[],
    reports: (reports ?? []) as Row[],
    report_events: (report_events ?? []) as Row[],
    claims: (claims ?? []) as Row[],
    orders: (orders ?? []) as Row[],
    entitlements: (entitlements ?? []) as Row[],
    notifications: (notifications ?? []) as Row[],
    privacy_access_log: (privacy_access_log ?? []) as Row[],
    uploads: (uploads ?? []) as Row[],
    notes: (notes ?? []) as Row[],
    compare_reports: (compare_reports ?? []) as Row[],
    consent_log: (consent_log ?? []) as Row[],
    matching_feedback: (matching_feedback ?? []) as Row[],
    ai_usage: (ai_usage ?? []) as Row[],
    review_checklist_items: (review_checklist_items ?? []) as Row[],
    creator_reviews: (creator_reviews ?? []) as Row[],
    inquiries: (inquiries ?? []) as Row[],
    credit_ledger: (credit_ledger ?? []) as Row[],
  };
}
