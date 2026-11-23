import { compatibleApiRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { snapshotAfterDeletion } from "@/lib/privacy-retention";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
import { BUCKET, SIGNED_URL_SECONDS, storageAdmin } from "@/lib/uploads";
// Short signed URL, created with the caller's own session so storage RLS decides (owner + live reference only).
 async function handlePOST(
  req: Request,
  ctx: RouteContext<"/api/uploads/[id]">,
) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return fail("파일을 찾을 수 없습니다.", 404);
  const { data: row } = await c.db
    .from("uploads")
    .select("path,original_name")
    .eq("id", id.data)
    .maybeSingle();
  if (!row) return fail("파일을 찾을 수 없습니다.", 404);
  const { data, error } = await c.db.storage
    .from(BUCKET)
    .createSignedUrl(row.path, SIGNED_URL_SECONDS, {
      // Storage percent-encodes non-ASCII download names, so those get a readable ASCII fallback.
      download: /^[\x20-\x7e]+$/.test(row.original_name)
        ? row.original_name
        : `file-${id.data.slice(0, 8)}.${row.path.split(".").pop()}`,
    });
  if (error) return fail("파일을 찾을 수 없습니다.", 404);
  return NextResponse.json(
    { url: data.signedUrl, expiresIn: SIGNED_URL_SECONDS },
    { headers: { "Cache-Control": "no-store" } },
  );
}
 async function handleDELETE(
  req: Request,
  ctx: RouteContext<"/api/uploads/[id]">,
) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return fail("파일을 찾을 수 없습니다.", 404);
  const { data: row } = await c.db
    .from("uploads")
    .select("path")
    .eq("id", id.data)
    .maybeSingle();
  const { error } = await c.db.rpc("delete_upload", { p_id: id.data });
  if (error || !row) return fail("파일을 찾을 수 없습니다.", 404);
  // Best effort now; the sweep job removes it later if this fails.
  const admin = storageAdmin();
  await admin?.storage.from(BUCKET).remove([row.path]);
  await snapshotAfterDeletion(admin);
  return NextResponse.json({ ok: true });
}

export const POST=compatibleApiRoute("src/app/api/uploads/[id]/route.ts.POST",handlePOST);
export const DELETE=compatibleApiRoute("src/app/api/uploads/[id]/route.ts.DELETE",handleDELETE);
