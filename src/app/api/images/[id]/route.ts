import { z } from "zod";
import { createHash } from "node:crypto";
import {
  apiRoute,
  fail,
  failDatabase,
  parseInput,
  requireContext,
} from "@/lib/api";
export const GET = apiRoute("images.download", async (req) => {
  const c = await requireContext(),
    id = parseInput(
      z.uuid(),
      new URL(req.url).pathname.split("/").pop(),
      "이미지를 확인해주세요.",
    );
  const { data, error } = await c.db.rpc("image_file_access", { p_id: id });
  if (error) failDatabase(error, "이미지에 접근할 수 없습니다.");
  const d = z
    .strictObject({
      id: z.uuid(),
      path: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.png$/),
      name: z.string().min(1).max(120),
      bytes: z.number().int().min(1).max(5242880),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .safeParse(data);
  if (!d.success || d.data.id !== id)
    fail("이미지 정보를 확인하지 못했습니다.", 503);
  const file = await c.db.storage
    .from("adme-private-images")
    .download(d.data.path);
  if (file.error || !file.data) fail("이미지를 불러오지 못했습니다.", 503);
  const bytes = await file.data.arrayBuffer();
  const current = await c.db.rpc("image_file_access", { p_id: id });
  if (current.error)
    failDatabase(current.error, "현재 이미지에 접근할 수 없습니다.");
  if (
    bytes.byteLength !== d.data.bytes ||
    createHash("sha256").update(Buffer.from(bytes)).digest("hex") !==
      d.data.sha256
  )
    fail("이미지 무결성을 확인하지 못했습니다.", 503);
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="image.png"; filename*=UTF-8''${encodeURIComponent(d.data.name + ".png")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});
