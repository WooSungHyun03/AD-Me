import sharp from "sharp";
import { createHash } from "node:crypto";
import { z } from "zod";
import { imageByteLimit } from "./image-limits";
export const imageUploadQuery = z
  .strictObject({
    id: z.uuid(),
    purpose: z.enum(["brand_logo", "message_image"]),
    proposalId: z.uuid().optional(),
    name: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine((v) => !/[\x00-\x1f\x7f/\\]/.test(v)),
  })
  .superRefine((v, ctx) => {
    if ((v.purpose === "message_image") !== !!v.proposalId)
      ctx.addIssue({ code: "custom", message: "Invalid image scope" });
  });
export const imageDescriptor = z.strictObject({
  id: z.uuid(),
  path: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.png$/),
  state: z.enum(["pending", "verified"]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export async function normalizePrivateImage(
  bytes: Uint8Array,
  purpose: "brand_logo" | "message_image",
) {
  if (!bytes.length || bytes.length > imageByteLimit)
    throw Error("이미지는 4MB 이하여야 합니다.");
  const b = Buffer.from(bytes);
  const png = b
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = b[0] === 255 && b[1] === 216 && b[2] === 255;
  const webp =
    b.subarray(0, 4).toString() === "RIFF" &&
    b.subarray(8, 12).toString() === "WEBP";
  if (!png && !jpeg && !webp) throw Error("지원하지 않는 이미지 형식입니다.");
  const image = sharp(bytes, {
      limitInputPixels: 16777216,
      animated: false,
      failOn: "warning",
    }),
    metadata = await image.metadata();
  if (
    !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
    (metadata.pages ?? 1) > 1
  )
    throw Error("정지 PNG·JPEG·WebP 이미지만 지원합니다.");
  const maximum = purpose === "brand_logo" ? 512 : 1000;
  const buffer = await image
    .rotate()
    .resize({
      width: maximum,
      height: maximum,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  if (buffer.length > imageByteLimit)
    throw Error("변환한 이미지가 너무 큽니다.");
  return { buffer, hash: createHash("sha256").update(buffer).digest("hex") };
}
