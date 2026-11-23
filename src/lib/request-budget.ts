import "server-only";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getConfig } from "./config";
import { supabase } from "./supabase";
import { requestBudgetSubjects } from "./request-budget-subjects";
const result = z.strictObject({
  allowed: z.boolean(),
  retryAfter: z.number().int().min(0).max(3600),
  mode: z.enum(["shared", "trusted"]),
});
export async function reserveRequestBudget(
  action: "login" | "signup" | "resend" | "recovery" | "search",
  account?: string,
): Promise<string | null> {
  const config = getConfig().supabase;
  if (!config) return "계정 서비스 연결을 준비 중입니다.";
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const subjects = requestBudgetSubjects(
    await headers(),
    process.env.VERCEL === "1",
    secret,
    account,
  );
  const hasSecret =
    !!secret &&
    (/^(sb_secret_)/.test(secret) ||
      (() => {
        try {
          return (
            JSON.parse(
              Buffer.from(secret.split(".")[1], "base64url").toString(),
            ).role === "service_role"
          );
        } catch {
          return false;
        }
      })());
  const trusted =
    hasSecret && (subjects.ip !== null || subjects.account !== null);
  const db = trusted
    ? createClient(config.url, secret!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : await supabase();
  const { data, error } = trusted
    ? await db.rpc("auth_edge_budget", {
        p_action: action,
        p_ip: subjects.ip,
        p_account: subjects.account,
      })
    : await db.rpc("auth_shared_budget", { p_action: action });
  const parsed = result.safeParse(data);
  if (error || !parsed.success)
    return "요청 한도를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.";
  return parsed.data.allowed
    ? null
    : `요청이 많습니다. ${parsed.data.retryAfter}초 후 다시 시도해주세요.`;
}
