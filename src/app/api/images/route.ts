import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseInput,
  requireContext,
} from "@/lib/api";
import { serverAdmin } from "@/lib/server-admin";
import { imageByteLimit } from "@/lib/image-limits";
import {
  imageDescriptor,
  imageUploadQuery,
  normalizePrivateImage,
} from "@/lib/private-images";
export const runtime = "nodejs";
export const POST = apiRoute("images.upload", async (req) => {
  const c = await requireContext(),
    admin = serverAdmin();
  if (!admin) fail("이미지 업로드 연결을 준비 중입니다.", 503);
  const q = parseInput(
    imageUploadQuery,
    Object.fromEntries(new URL(req.url).searchParams),
    "이미지 업로드 항목을 확인해주세요.",
  );
  const attempt = await c.db.rpc("image_upload_attempt");
  if (attempt.error)
    failDatabase(attempt.error, "이미지 업로드 한도에 도달했습니다.");
  // Read a strict byte budget before invoking any image decoder; Content-Length
  // is only an early hint and never trusted as the actual payload size.
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (!req.body) fail("이미지 파일이 필요합니다.", 422);
  const reader = req.body.getReader();
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.byteLength;
      if (size > imageByteLimit) {
        await reader.cancel();
        fail("이미지는 4MB 이하여야 합니다.", 422);
      }
      chunks.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  let image: Awaited<ReturnType<typeof normalizePrivateImage>>;
  try {
    image = await normalizePrivateImage(Buffer.concat(chunks), q.purpose);
  } catch {
    fail("정지 PNG·JPEG·WebP 이미지를 확인해주세요. 최대 4MB입니다.", 422);
  }
  const { data, error } = await c.db.rpc("image_upload_reserve", {
    p_id: q.id,
    p_purpose: q.purpose,
    p_proposal: q.proposalId ?? null,
    p_name: q.name,
    p_sha256: image.hash,
    p_bytes: image.buffer.length,
  });
  if (error)
    failDatabase(error, "이미지 저장 권한이나 현재 상태를 확인해주세요.");
  const parsed = imageDescriptor.safeParse(data);
  if (!parsed.success) fail("이미지 저장 정보를 확인하지 못했습니다.", 503);
  const f = parsed.data;
  if (f.id !== q.id || !f.path.startsWith(c.user.id + "/"))
    fail("이미지 소유권을 확인하지 못했습니다.", 503);
  if (f.state !== "verified") {
    const uploaded = await c.db.storage
      .from("adme-private-images")
      .upload(f.path, image.buffer, {
        contentType: "image/png",
        upsert: false,
      });
    if (uploaded.error) {
      const stored = await c.db.storage
        .from("adme-private-images")
        .download(f.path);
      if (
        stored.error ||
        !stored.data ||
        !Buffer.from(await stored.data.arrayBuffer()).equals(image.buffer)
      )
        fail(
          "이미지 저장을 완료하지 못했습니다. 같은 파일로 다시 시도해주세요.",
          503,
        );
    }
    const verified = await admin.rpc("image_upload_verify", {
      p_id: f.id,
      p_owner: c.user.id,
      p_hash: image.hash,
      p_bytes: image.buffer.length,
    });
    if (verified.error)
      fail(
        "이미지 확인을 완료하지 못했습니다. 같은 파일로 다시 시도해주세요.",
        503,
      );
  }
  let messageId: string | undefined;
  if (q.purpose === "message_image") {
    const sent = await c.db.rpc("image_message_publish", { p_id: f.id });
    if (sent.error)
      failDatabase(sent.error, "현재 대화방에 이미지를 보낼 수 없습니다.");
    if (!z.uuid().safeParse(sent.data).success)
      fail("이미지 메시지 응답을 확인하지 못했습니다.", 503);
    messageId = sent.data;
  }
  return Response.json(
    { ok: true, id: f.id, ...(messageId ? { messageId } : {}) },
    { headers: { "Cache-Control": "no-store" } },
  );
});
