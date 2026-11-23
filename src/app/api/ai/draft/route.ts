import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, safeOrigin } from "@/lib/api";
import {
  configuredProvider,
  generate,
  KINDS,
  LIMITS,
  type Kind,
} from "@/lib/ai";
import { currentUser } from "@/lib/supabase";
import { storageAdmin } from "@/lib/uploads";
// D048: returns a draft only. Nothing is sent to a creator or saved; the user reviews and copies it.
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const body = await req.json().catch(() => null);
  const kind = z.enum(KINDS as [Kind, ...Kind[]]).safeParse(body?.kind);
  if (!kind.success) return fail("초안 종류를 확인해주세요.");
  const user = await currentUser();
  const admin = user ? storageAdmin() : null;
  const r = await generate(kind.data, body?.input, {
    provider: configuredProvider(),
    reserve: admin
      ? async () => {
          const { data } = await admin.rpc("reserve_ai_call", {
            p_user: user!.id,
            p_user_limit: LIMITS.userDaily,
            p_global_limit: LIMITS.globalDaily,
          });
          return data === true;
        }
      : undefined,
    record: admin
      ? async (u) => {
          await admin.rpc("record_ai_tokens", {
            p_user: user!.id,
            p_in: u.input_tokens,
            p_out: u.output_tokens,
          });
        }
      : undefined,
  });
  if ("error" in r) return fail(r.error);
  return NextResponse.json(r);
}
