import { describe, expect, it } from "vitest";
import { inspectFile, safeName, MAX_BYTES } from "../src/lib/uploads";
const bytes = (...xs: (number[] | string)[]) =>
  new Uint8Array(
    xs.flatMap((x) =>
      typeof x === "string" ? [...Buffer.from(x, "latin1")] : x,
    ),
  );
const png = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "rest");
const jpg = bytes([0xff, 0xd8, 0xff, 0xe0], "rest");
const webp = bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ");
const pdf = bytes("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF");
describe("D027 upload inspection", () => {
  it("accepts real images and plain PDFs by magic bytes", () => {
    expect(inspectFile(png, "a.PNG", "image/png")).toEqual({
      mime: "image/png",
      ext: "png",
    });
    expect(inspectFile(jpg, "a.jpeg", "")).toEqual({
      mime: "image/jpeg",
      ext: "jpg",
    });
    expect(inspectFile(webp, "a.webp", "application/octet-stream")).toEqual({
      mime: "image/webp",
      ext: "webp",
    });
    expect(inspectFile(pdf, "cv.pdf", "application/pdf")).toEqual({
      mime: "application/pdf",
      ext: "pdf",
    });
  });
  it("refuses disguised, executable and mismatched files", () => {
    expect(
      inspectFile(
        bytes("<html><script>alert(1)</script>"),
        "x.png",
        "image/png",
      ),
    ).toEqual({ error: "bad_content" });
    expect(
      inspectFile(
        bytes('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
        "x.svg",
        "image/svg+xml",
      ),
    ).toEqual({ error: "bad_extension" });
    expect(
      inspectFile(bytes("<svg onload=alert(1)>"), "x.jpg", "image/jpeg"),
    ).toEqual({ error: "bad_content" });
    expect(
      inspectFile(bytes([0x4d, 0x5a, 0x90, 0]), "x.pdf", "application/pdf"),
    ).toEqual({ error: "bad_content" });
    expect(inspectFile(png, "x.html", "text/html")).toEqual({
      error: "bad_extension",
    });
    expect(inspectFile(png, "x.jpg", "image/jpeg")).toEqual({
      error: "mismatch",
    });
    expect(inspectFile(png, "x.png", "image/jpeg")).toEqual({
      error: "mismatch",
    });
    expect(inspectFile(png, "noext", "image/png")).toEqual({
      error: "bad_extension",
    });
  });
  it("refuses active PDFs, empty and oversized files", () => {
    expect(
      inspectFile(
        bytes(
          "%PDF-1.7 << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>",
        ),
        "a.pdf",
        "",
      ),
    ).toEqual({ error: "active_pdf" });
    expect(
      inspectFile(bytes("%PDF-1.4 << /Launch /F (cmd.exe) >>"), "a.pdf", ""),
    ).toEqual({ error: "active_pdf" });
    expect(inspectFile(new Uint8Array(), "a.png", "")).toEqual({
      error: "empty",
    });
    const big = new Uint8Array(MAX_BYTES + 1);
    big.set(png);
    expect(inspectFile(big, "a.png", "")).toEqual({ error: "too_large" });
  });
  it("display names cannot carry paths or markup", () => {
    expect(safeName("../../etc/passwd")).toBe("passwd");
    expect(safeName('C:\\x\\"<b>.png')).toBe("b.png");
    expect(safeName("a".repeat(300)).length).toBe(120);
  });
});
