import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// D007: every shipped image must have a provenance row; unknown rights stay explicit.
// fileURLToPath: URL.pathname yields "/C:/..." on Windows, which join() turns into "C:\C:\...".
const root = fileURLToPath(new URL("..", import.meta.url));
const images = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? images(join(dir, entry.name))
      : /\.(png|jpe?g|webp|gif|svg|ico|avif)$/i.test(entry.name)
        ? [
            relative(root, join(root, dir, entry.name))
              .split(sep)
              .join("/"),
          ]
        : [],
  );

describe("shipped asset provenance", () => {
  const inventory = readFileSync(join(root, "docs/licenses/README.md"), "utf8");
  it("lists every image under public/ and assets/ in the asset table", () => {
    const missing = [...images("public"), ...images("assets")].filter(
      (path) =>
        !inventory.includes(`\`${path}\``) &&
        // shortcut: basename match covers the existing crop rows; list full paths if names collide.
        !inventory.includes(`\`${path.split("/").pop()}\``),
    );
    expect(missing).toEqual([]);
  });
  it("keeps people imagery from the Figma import marked rights-unverified", () => {
    expect(inventory).toMatch(
      /public\/brand\/figma\/hero\.png[^\n]*RIGHTS_UNVERIFIED/,
    );
  });
});
