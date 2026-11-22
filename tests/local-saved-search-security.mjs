import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { localClient, localRuntime, sql } from "./support/local-qa.mjs";
localRuntime();
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
const owner = localClient(),
  other = localClient(),
  anon = localClient();
for (const [client, account] of [
  [owner, accounts.brand],
  [other, accounts.other],
])
  assert.equal((await client.auth.signInWithPassword(account)).error, null);
const filters = {
  query: "가상 QA",
  categories: [],
  platforms: ["instagram"],
  tags: [],
  minPrice: "",
  maxPrice: "",
  minFollowers: "",
  maxFollowers: "",
  minEngagement: "",
  available: false,
  sort: "name",
};
const id = randomUUID(),
  created = [id];
const put = (client, id, expected = 0, f = filters) =>
  client.rpc("saved_search_put", {
    p_id: id,
    p_expected: expected,
    p_name: "가상 저장 검색",
    p_filters: f,
  });
let groups = 0;
try {
  assert.equal((await put(owner, id)).error, null);
  const list = await owner.rpc("saved_search_list");
  assert.equal(list.error, null);
  const row = list.data.find((x) => x.id === id);
  assert.equal(row.filterVersion, 1);
  assert.equal(row.revision, 1);
  assert.ok(!("owner_id" in row));
  groups++;
  assert.equal(
    (await other.rpc("saved_search_list")).data.some((x) => x.id === id),
    false,
  );
  assert.equal((await put(other, id, 1)).error.code, "P0002");
  assert.equal(
    (await other.rpc("saved_search_delete", { p_id: id, p_expected: 1 })).error
      .code,
    "P0002",
  );
  groups++;
  assert.ok((await anon.rpc("saved_search_list")).error);
  assert.equal(
    sql(
      "select has_table_privilege('authenticated','adme_search.saved_conditions','select'),has_schema_privilege('authenticated','adme_search','usage'),has_function_privilege('authenticated','adme_search.valid_filters(jsonb)','execute');",
    ),
    "f|f|f",
  );
  groups++;
  for (const f of [
    { ...filters, gender: "x" },
    { ...filters, sort: null },
    { ...filters, minEngagement: "0000" },
    { ...filters, platforms: ["unknown"] },
    { ...filters, maxPrice: "1", minPrice: "2" },
  ])
    assert.equal((await put(owner, randomUUID(), 0, f)).error.code, "22023");
  groups++;
  const race = await Promise.all([put(owner, id, 1), put(owner, id, 1)]);
  assert.equal(race.filter((x) => !x.error).length, 1);
  assert.equal(race.find((x) => x.error).error.code, "40001");
  groups++;
  assert.equal(
    (await owner.rpc("saved_search_delete", { p_id: id, p_expected: 1 })).error
      .code,
    "40001",
  );
  assert.equal(
    (await owner.rpc("saved_search_delete", { p_id: id, p_expected: 2 })).error,
    null,
  );
  assert.equal(
    (await owner.rpc("saved_search_list")).data.some((x) => x.id === id),
    false,
  );
  groups++;
  for (let n = 0; n < 20; n++) {
    const next = randomUUID();
    created.push(next);
    assert.equal((await put(other, next)).error, null);
  }
  assert.equal((await put(other, randomUUID())).error.code, "54000");
  groups++;
  writeFileSync(
    "output/saved-search-security.local.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        groups,
        result: "PASS",
        scope:
          "Actual local Auth/PostgREST/Postgres; fictional QA accounts. No notification/provider/cloud verification.",
      },
      null,
      2,
    ),
  );
  console.log(`PASS saved-search security ${groups} groups`);
} finally {
  sql(
    `delete from adme_search.saved_conditions where id in(${created.map((x) => `'${x}'`).join(",")});`,
  );
}
