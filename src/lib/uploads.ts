import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export const BUCKET = "private-uploads";
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 20;
export const SIGNED_URL_SECONDS = 60;
const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const uploadErrors: Record<string, string> = {
  empty: "빈 파일은 올릴 수 없습니다.",
  too_large: "파일은 5MB 이하만 올릴 수 있습니다.",
  bad_extension: "PNG·JPG·WEBP·PDF 파일만 올릴 수 있습니다.",
  bad_content: "파일 내용이 허용된 이미지·PDF 형식이 아닙니다.",
  mismatch: "파일 확장자·형식이 실제 내용과 다릅니다.",
  active_pdf: "스크립트·첨부 파일이 들어 있는 PDF는 올릴 수 없습니다.",
  rights: "업로드할 권리가 있는 파일인지 확인해주세요.",
  quota: `파일은 계정당 ${MAX_FILES}개까지 보관할 수 있습니다.`,
};
// Real type from magic bytes; anything else (HTML, SVG, scripts, executables, archives) is refused.
export function sniff(b: Uint8Array): string | null {
  const at = (i: number, ...xs: number[]) => xs.every((x, j) => b[i + j] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50))
    return "image/webp";
  if (at(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  return null;
}
// shortcut: plain-text scan misses names hidden in compressed object streams; files are also served only as
// attachment downloads. Upgrade to a PDF parser/sanitizer before showing PDFs inline.
const ACTIVE_PDF =
  /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA|AA|OpenAction)\b/;
export function inspectFile(
  b: Uint8Array,
  name: string,
  declared: string,
): { error: keyof typeof uploadErrors } | { mime: string; ext: string } {
  if (b.length === 0) return { error: "empty" };
  if (b.length > MAX_BYTES) return { error: "too_large" };
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (!EXT_MIME[ext]) return { error: "bad_extension" };
  const mime = sniff(b);
  if (!mime) return { error: "bad_content" };
  if (EXT_MIME[ext] !== mime) return { error: "mismatch" };
  if (declared && declared !== "application/octet-stream" && declared !== mime)
    return { error: "mismatch" };
  if (
    mime === "application/pdf" &&
    ACTIVE_PDF.test(Buffer.from(b).toString("latin1"))
  )
    return { error: "active_pdf" };
  return { mime, ext: MIME_EXT[mime] };
}
// Display name only; never used in the storage path.
export const safeName = (name: string) =>
  name
    .replace(/^.*[\\/]/, "")
    .replace(/[\u0000-\u001f\u007f"<>]/g, "")
    .trim()
    .slice(0, 120) || "file";
// Server-only key: used for writes the browser must never make (storage insert/remove, reference rows).
export function storageAdmin(): SupabaseClient | null {
  if (typeof window !== "undefined") throw new Error("server only");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
// Removes objects whose reference was deleted, and objects with no reference older than the grace period
// (e.g. a crash between storage write and row insert). Deleted reference rows are purged after their object.
// shortcut: lists every owner folder (fine at TEST scale); upgrade to a storage-event queue beyond ~10k files.
export async function sweepUploads(
  admin: SupabaseClient,
  graceMs = 60 * 60 * 1000,
  now = Date.now(),
) {
  const { data: rows, error } = await admin
    .from("uploads")
    .select("id,path,status");
  if (error) throw new Error("sweep_query_failed");
  const live = new Set(
    rows.filter((r) => r.status === "ready").map((r) => r.path),
  );
  const dead = rows.filter((r) => r.status === "deleted");
  const { data: folders } = await admin.storage
    .from(BUCKET)
    .list("", { limit: 1000 });
  const orphans: string[] = [];
  for (const f of folders ?? []) {
    const { data: files } = await admin.storage
      .from(BUCKET)
      .list(f.name, { limit: 1000 });
    for (const o of files ?? []) {
      const path = `${f.name}/${o.name}`;
      if (!live.has(path) && now - Date.parse(o.created_at ?? "") > graceMs)
        orphans.push(path);
    }
  }
  const remove = [...new Set([...orphans, ...dead.map((r) => r.path)])];
  if (remove.length) {
    const { error: e } = await admin.storage.from(BUCKET).remove(remove);
    if (e) throw new Error("sweep_remove_failed");
  }
  if (dead.length)
    await admin
      .from("uploads")
      .delete()
      .in(
        "id",
        dead.map((r) => r.id),
      );
  return {
    removed: remove.length,
    orphans: orphans.length,
    purgedRows: dead.length,
  };
}
