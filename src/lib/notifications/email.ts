// D053: app notification email (service/marketing). NOT the Supabase Auth emails (signup confirm, password
// reset) — those are sent by Supabase Auth through its own SMTP setting and are never queued here.
import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_ATTEMPTS = 5; // mirrored in finish_email(): the 5th failure is dead-lettered
type Template = { subject: string; body: string };
// Versioned copy: changing wording means a new version key, so a sent mail can be traced to its text.
// Bodies contain no message content or personal data: they point back to the signed-in app.
export const TEMPLATES: Record<string, Record<string, Template>> = {
  notification_status: {
    v1: {
      subject: "[AD Me] 협업 상태가 바뀌었습니다",
      body: "진행 중인 협업의 상태가 변경되었습니다. 로그인 후 대시보드에서 확인하세요.",
    },
  },
  notification_message: {
    v1: {
      subject: "[AD Me] 새 메시지가 있습니다",
      body: "협업 상대가 메시지를 보냈습니다. 내용은 로그인 후 대시보드에서 확인하세요.",
    },
  },
  notification_deliverable: {
    v1: {
      subject: "[AD Me] 결과물이 제출되었습니다",
      body: "협업 결과물이 제출되었습니다. 로그인 후 확인하세요.",
    },
  },
  marketing: {
    v1: {
      subject: "[AD Me·광고] 새 소식",
      body: "AD Me 새 기능과 캠페인 소식입니다. 이 메일은 마케팅 수신에 동의한 분께만 발송됩니다.",
    },
  },
};
export type Claimed = {
  id: number;
  purpose: "service" | "marketing";
  template: string;
  template_version: string;
  source_key: string;
  email: string;
  attempts: number;
  unsubscribe: string;
};
export type Mail = {
  to: string;
  subject: string;
  text: string;
  headers: Record<string, string>;
  idempotencyKey: string;
};
export type Sender = { name: string; send(m: Mail): Promise<void> };

export function render(row: Claimed, appUrl: string): Mail {
  const t = TEMPLATES[row.template]?.[row.template_version];
  if (!t) throw new Error("unknown_template");
  const unsub = `${appUrl}/unsubscribe?t=${encodeURIComponent(row.unsubscribe)}`;
  const what = row.purpose === "marketing" ? "마케팅 메일" : "서비스 알림 메일";
  return {
    to: row.email,
    subject: t.subject,
    text: `${t.body}\n\n${appUrl}/dashboard\n\n${what} 수신을 원하지 않으면: ${unsub}\n(수신 설정은 로그인 후 설정 화면에서도 바꿀 수 있습니다.)`,
    headers: {
      "List-Unsubscribe": `<${unsub}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    // Same event+recipient+channel → same key, so a provider-side retry cannot double-send.
    idempotencyKey: `adme-${row.source_key}-${row.id}`,
  };
}

// shortcut: no provider adapter is wired — needs a chosen email API and its server-only key (U007).
// Until then the worker refuses to claim anything and nothing is reported as sent.
export function configuredSender(): Sender | null {
  return null;
}

export async function runOutbox(
  svc: SupabaseClient,
  sender: Sender | null,
  appUrl: string,
  limit = 20,
) {
  if (!sender)
    return {
      blocked: "메일 발송 공급자 미설정",
      claimed: 0,
      sent: 0,
      failed: 0,
    };
  const { data, error } = await svc.rpc("claim_emails", { p_limit: limit });
  if (error) throw new Error("claim_failed");
  let sent = 0,
    failed = 0;
  for (const row of (data ?? []) as Claimed[]) {
    let ok = false,
      err: string | null = null;
    try {
      await sender.send(render(row, appUrl));
      ok = true;
    } catch (e) {
      err = String((e as Error)?.message ?? "send_error").slice(0, 200); // error code only, no addresses
    }
    await svc.rpc("finish_email", { p_id: row.id, p_ok: ok, p_error: err });
    if (ok) sent++;
    else failed++;
  }
  return { blocked: null, claimed: (data ?? []).length, sent, failed };
}
