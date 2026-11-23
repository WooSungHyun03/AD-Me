import { compatibleApiRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { context, fail, safeOrigin } from "@/lib/api";
import {
  BUCKET,
  MAX_BYTES,
  MAX_FILES,
  inspectFile,
  safeName,
  storageAdmin,
  uploadErrors,
} from "@/lib/uploads";
// Server-verified upload: size, extension and magic bytes are checked before anything reaches storage.
async function handlePOST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  if (c.role !== "creator")
    return fail("크리에이터 계정만 포트폴리오 파일을 올릴 수 있습니다.", 403);
  // Refuse oversized bodies before parsing them.
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024)
    return fail(uploadErrors.too_large, 413);
  const admin = storageAdmin();
  if (!admin) return fail("파일 업로드가 아직 설정되지 않았습니다.", 503);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail(uploadErrors.empty);
  if (form?.get("rights") !== "on") return fail(uploadErrors.rights);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const r = inspectFile(bytes, file.name, file.type);
  if ("error" in r)
    return fail(uploadErrors[r.error], r.error === "too_large" ? 413 : 415);
  const { count } = await c.db
    .from("uploads")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_FILES) return fail(uploadErrors.quota, 409);
  const id = randomUUID();
  const path = `${c.user.id}/${id}.${r.ext}`;
  const up = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: r.mime, upsert: false });
  if (up.error) return fail("파일을 저장하지 못했습니다.", 500);
  const ins = await admin.from("uploads").insert({
    id,
    owner_id: c.user.id,
    path,
    mime: r.mime,
    size_bytes: bytes.length,
    original_name: safeName(file.name),
    rights_confirmed: true,
  });
  if (ins.error) {
    await admin.storage.from(BUCKET).remove([path]); // no orphan if the reference fails
    return fail("파일을 저장하지 못했습니다.", 500);
  }
  return NextResponse.json(
    { ok: true, id, mime: r.mime, size: bytes.length },
    { status: 201 },
  );
}

export const POST = compatibleApiRoute(
  "src/app/api/uploads/route.ts.POST",
  handlePOST,
  { maxBodyBytes: MAX_BYTES + 64 * 1024 },
);
