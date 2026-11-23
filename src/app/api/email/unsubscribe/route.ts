import { compatibleApiRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { fail } from "@/lib/api";
// D053: one-click unsubscribe (RFC 8058). POST only, so link scanners that prefetch GET cannot unsubscribe.
// Accepts the page form (JSON) and mail clients' "List-Unsubscribe=One-Click" form posts.
 async function handlePOST(req: Request) {
  const url = new URL(req.url);
  const body = req.headers.get("content-type")?.includes("json")
    ? await req.json().catch(() => null)
    : null;
  const t = z
    .string()
    .max(200)
    .safeParse(body?.token ?? url.searchParams.get("t"));
  if (!t.success) return fail("잘못된 수신거부 링크입니다.");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
    },
  );
  const { data, error } = await db.rpc("unsubscribe_email", {
    p_token: t.data,
  });
  if (error) return fail("잘못되었거나 만료된 수신거부 링크입니다.");
  return NextResponse.json({ ok: true, purpose: data });
}

export const POST=compatibleApiRoute("src/app/api/email/unsubscribe/route.ts.POST",handlePOST);
