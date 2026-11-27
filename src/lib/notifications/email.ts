// D053: app notification email (service/marketing). NOT the Supabase Auth emails (signup confirm, password
// reset) — those are sent by Supabase Auth through its own SMTP setting and are never queued here.
import type { SupabaseClient } from "@supabase/supabase-js";
import { mask } from "@/lib/observability";

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

// D053/U007: Resend HTTP API sender for app notification mail (Resend already serves Auth SMTP for
// mail.be-celeb.org). Server-only RESEND_API_KEY and ADME_MAIL_FROM must both be set; otherwise the worker
// refuses to claim anything and nothing is reported as sent. The idempotency key makes a retried POST
// within 24h return the original result instead of sending again. Errors carry only the status and
// Resend's fixed error name, never the response body (it can echo the recipient).
export const RESEND_URL = "https://api.resend.com/emails";
// "addr@domain" or "Name <addr@domain>"; no line breaks (header injection).
const FROM =
  /^(?:[^<>\r\n]{1,80} <[^\s<>@]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}>|[^\s<>@]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})$/;
export function resendSender(
  apiKey: string,
  from: string,
  fetchImpl: typeof fetch = fetch,
): Sender {
  return {
    name: "resend",
    async send(m) {
      let res: Response;
      try {
        res = await fetchImpl(RESEND_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": m.idempotencyKey.slice(0, 256),
          },
          body: JSON.stringify({
            from,
            to: [m.to],
            subject: m.subject,
            text: m.text,
            headers: m.headers,
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new Error("resend_network");
      }
      if (res.ok) return;
      let name = "";
      try {
        const body = (await res.json()) as { name?: unknown };
        if (typeof body?.name === "string" && /^[a-z_]{1,60}$/.test(body.name))
          name = `_${body.name}`;
      } catch {}
      throw new Error(`resend_${res.status}${name}`);
    },
  };
}
export function configuredSender(
  env: Record<string, string | undefined> = process.env,
): Sender | null {
  const key = env.RESEND_API_KEY?.trim();
  const from = env.ADME_MAIL_FROM?.trim();
  if (!key || !from || !key.startsWith("re_") || !FROM.test(from)) return null;
  return resendSender(key, from);
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
      // D078: provider text can echo the recipient or credential; store it only after the shared redaction.
      err = String(mask(String((e as Error)?.message ?? "send_error"))).slice(
        0,
        200,
      );
    }
    await svc.rpc("finish_email", { p_id: row.id, p_ok: ok, p_error: err });
    if (ok) sent++;
    else failed++;
  }
  return { blocked: null, claimed: (data ?? []).length, sent, failed };
}
