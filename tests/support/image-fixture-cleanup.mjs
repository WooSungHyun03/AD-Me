import assert from "node:assert/strict";
import { localRuntime, localClient, sql } from "./local-qa.mjs";
export async function cleanImageFixtures(owners) {
  const runtime = localRuntime();
  for (const id of owners) assert.match(id, /^[a-f0-9-]{36}$/);
  if (!owners.length) return;
  const list = owners.map((id) => `'${id}'`).join(",");
  const paths = JSON.parse(
    sql(
      `select coalesce(jsonb_agg(object_path),'[]') from adme_upload.files where owner_id in(${list});`,
    ),
  );
  if (paths.length) {
    const removed = await localClient(runtime.SERVICE_ROLE_KEY)
      .storage.from("adme-private-images")
      .remove(paths);
    assert.equal(removed.error, null);
  }
  sql(
    `delete from adme_upload.brand_logos where owner_id in(${list});delete from adme_upload.files where owner_id in(${list});`,
  );
}
