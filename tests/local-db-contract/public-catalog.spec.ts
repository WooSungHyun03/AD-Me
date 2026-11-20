import { expect, it } from "vitest";
import { localClient, localRuntime } from "../support/local-qa.mjs";
import { readPublicCreatorCatalog } from "@/lib/creator-catalog-read";
it("validates the real SQL allowlist/cursor contract through the production reader", async () => {
  localRuntime();
  const rows = await readPublicCreatorCatalog(localClient());
  expect(rows.filter((c) => c.is_demo)).toHaveLength(48);
  for (const row of rows) {
    expect(row).not.toHaveProperty("owner_id");
    expect(row).not.toHaveProperty("owner_consent");
    if (!row.is_demo) expect(row.followers).toBeNull();
  }
});
