import { expect, it } from "vitest";
import sharp from "sharp";
import { normalizePrivateImage, imageUploadQuery } from "@/lib/private-images";
it("decodes actual images, bounds dimensions and strips metadata into deterministic PNGs", async () => {
  const source = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: "#d7ff45" },
  })
    .jpeg()
    .withMetadata({ density: 300 })
    .toBuffer();
  const a = await normalizePrivateImage(source, "brand_logo"),
    b = await normalizePrivateImage(source, "brand_logo");
  expect(a.hash).toBe(b.hash);
  const m = await sharp(a.buffer).metadata();
  expect(m.format).toBe("png");
  expect(m.width).toBe(512);
  expect(m.height).toBe(256);
  expect(m.exif).toBeUndefined();
  expect(m.icc).toBeUndefined();
});
it("rejects SVG/HTML, corrupt magic headers, oversized data and invalid scopes", async () => {
  for (const input of [
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    Buffer.from("<script>bad</script>"),
    Buffer.alloc(5242881),
    Buffer.from([255, 216, 255, 0]),
  ])
    await expect(
      normalizePrivateImage(input, "message_image"),
    ).rejects.toThrow();
  expect(
    imageUploadQuery.safeParse({
      id: "00000000-0000-4000-8000-000000000001",
      purpose: "brand_logo",
      name: "../unsafe.png",
    }).success,
  ).toBe(false);
  expect(
    imageUploadQuery.safeParse({
      id: "00000000-0000-4000-8000-000000000001",
      purpose: "message_image",
      name: "image.png",
    }).success,
  ).toBe(false);
});
