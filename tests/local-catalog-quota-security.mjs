import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  localClient,
  localJwt,
  localRuntime,
  sql,
} from "./support/local-qa.mjs";
const runtime = localRuntime(),
  user = randomUUID(),
  other = randomUUID();
const results = [];
try {
  sql(
    `insert into auth.users(id,raw_user_meta_data) values('${user}','{"role":"brand","name":"가상 catalog quota QA"}'),('${other}','{"role":"brand","name":"가상 격리 quota QA"}');`,
  );
  // Keep the concurrency assertion inside one real fixed window, without
  // resetting unrelated counters or replacing server time.
  if (Number(sql("select extract(second from clock_timestamp());")) > 56)
    await new Promise((r) => setTimeout(r, 4100));
  const token = localJwt(user);
  const request = () =>
    fetch(`${runtime.API_URL}/rest/v1/rpc/creator_catalog_page`, {
      method: "POST",
      headers: {
        apikey: runtime.ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_after: "", p_limit: 1 }),
    });
  const responses = await Promise.all(Array.from({ length: 65 }, request));
  assert.equal(responses.filter((r) => r.status === 200).length, 60);
  assert.equal(responses.filter((r) => r.status === 429).length, 5);
  for (const response of responses.filter((r) => r.status === 429)) {
    const seconds = Number(response.headers.get("retry-after"));
    assert.ok(seconds >= 1 && seconds <= 60);
    const body = await response.json();
    assert.equal(body.code, "PT429");
    assert.equal(JSON.parse(body.details).retryAfter, seconds);
  }
  results.push({
    name: "65 concurrent direct POST calls admit exactly60 and return five exact429 Retry-After responses",
    result: "PASS",
  });
  assert.equal(
    (
      await localClient(undefined, localJwt(other)).rpc(
        "creator_catalog_page",
        { p_after: "", p_limit: 1 },
      )
    ).error,
    null,
  );
  assert.deepEqual(
    (await localClient(undefined, token).from("creators").select("*")).data,
    [],
  );
  const get = await fetch(
    `${runtime.API_URL}/rest/v1/rpc/creator_catalog_page?p_after=&p_limit=1`,
    { headers: { apikey: runtime.ANON_KEY, Authorization: `Bearer ${token}` } },
  );
  assert.equal(get.status, 405);
  assert.equal(
    sql(
      "select has_function_privilege('anon','adme_creator.catalog_page_rows(text,integer)','execute') or has_function_privilege('authenticated','adme_creator.catalog_page_rows(text,integer)','execute');",
    ),
    "f",
  );
  assert.equal(
    sql(
      "select provolatile::text||','||prosecdef::text from pg_proc where oid='public.creator_catalog_page(text,integer)'::regprocedure;",
    ),
    "v,false",
  );
  results.push({
    name: "other-account access survives and GET/raw-table/private-leaf bypasses remain denied",
    result: "PASS",
  });
} finally {
  sql(
    `delete from adme_ops.rate_windows where scope='creator_catalog' and subject in ('${user}','${other}'); delete from auth.users where id in ('${user}','${other}');`,
  );
}
for (const r of results) console.log(`PASS ${r.name}`);
writeFileSync(
  "output/dev-a-db/catalog-quota-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "isolated fictional Auth/PostgREST; no hosted changes or real provider",
      results,
    },
    null,
    2,
  ),
);
