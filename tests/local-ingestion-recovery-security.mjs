import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import {
  localRuntime,
  localClient,
  localJwt,
  sql,
} from "./support/local-qa.mjs";
import { enableLocalIngestionPolicy } from "./support/ingestion-fixture.mjs";
const runtime = localRuntime(),
  worker = localClient(),
  service = localClient(runtime.SERVICE_ROLE_KEY),
  owner = randomUUID(),
  token = randomBytes(32).toString("hex"),
  jobs = [],
  channels = Array.from(
    { length: 5 },
    () => "UC" + randomBytes(11).toString("hex"),
  ),
  results = [];
const previous = JSON.parse(
  sql(
    "select jsonb_build_object('worker',encode(s.worker_hash,'hex'),'ingestion',c.ingestion_enabled,'budget',coalesce((select jsonb_agg(r) from adme_ops.rate_windows r where scope='provider_day' and subject='youtube'),'[]'),'queued',coalesce((select jsonb_agg(jsonb_build_object('id',id,'available',available_at)) from adme_ops.jobs where status='queued'),'[]')) from adme_ops.settings s cross join adme_ops.resource_controls c;",
  ),
);
const previousSearch = JSON.parse(
  sql(
    "select coalesce(jsonb_agg(r),'[]') from adme_ops.rate_windows r where scope='source_search_24h' and subject='youtube';",
  ),
);
const check = async (name, run) => {
  await run();
  results.push({ name, result: "PASS" });
  console.log("PASS " + name);
};
const job = (kind, input) => {
  const id = randomUUID();
  sql(
    `insert into adme_ops.jobs(id,kind,owner_id,input,created_at) values('${id}','${kind}','${owner}','${input}',now()-interval '10 minutes');`,
  );
  jobs.push(id);
  return id;
};
const claim = async () => {
  const r = await worker.rpc("ops_worker_claim", { p_token: token });
  assert.equal(r.error, null);
  return r.data;
};
const row = (id) => ({
  id,
  title: "가상 수집 계약 QA",
  subscribers: null,
  videos: [
    {
      id: "fictional01",
      title: "가상 원본 영상",
      publishedAt: "2026-11-01T00:00:00Z",
      views: 0,
      likes: null,
      thumbnail: "https://example.test/fictional.jpg",
    },
  ],
  metadata: {
    handle: "@fictional-qa",
    views: 0,
    private_canary: "MUST_NOT_PERSIST",
  },
});
const checkpoint = (j, candidates, batch) =>
  worker.rpc("ops_worker_checkpoint", {
    p_token: token,
    p_id: j.id,
    p_lease: j.lease,
    p_candidates: candidates,
    p_result: batch,
  });
const finish = (j, error = null) =>
  worker.rpc("ops_worker_finish", {
    p_token: token,
    p_id: j.id,
    p_lease: j.lease,
    p_result: [],
    p_error: error,
    p_elapsed: 1,
  });
try {
  enableLocalIngestionPolicy();
  sql(
    "delete from adme_ops.rate_windows where scope='source_search_24h' and subject='youtube';update adme_ops.source_runtime_policies set search_calls_24h=5 where version='local-source-policy-1';",
  );
  sql(
    `insert into auth.users(id,raw_user_meta_data)values('${owner}','{"role":"creator","name":"가상 queue QA"}');update adme_ops.resource_controls set ingestion_enabled=true;update adme_ops.settings set worker_hash=sha256(convert_to('${token}','UTF8'));delete from adme_ops.rate_windows where scope='provider_day' and subject='youtube';update adme_ops.jobs set available_at=now()+interval '2 days' where status='queued';`,
  );
  await check(
    "policy OFF and unauthorized worker cannot spend provider budget or claim a source job",
    async () => {
      const id = job("youtube_channel", channels[0]);
      sql(
        "update adme_ops.source_runtime_policies set enabled=false where version='local-source-policy-1';",
      );
      assert.equal(await claim(), null);
      assert.equal(
        sql(
          "select count(*) from adme_ops.rate_windows where scope='provider_day' and subject='youtube';",
        ),
        "0",
      );
      assert.ok(
        (await worker.rpc("ops_worker_claim", { p_token: "invalid-token" }))
          .error,
      );
      enableLocalIngestionPolicy();
      sql(`update adme_ops.jobs set available_at=now() where id='${id}';`);
    },
  );
  await check(
    "concurrent source claims coalesce duplicate fetches and checkpoint commits before lost lease recovery",
    async () => {
      const duplicate = job("youtube_channel", channels[0]);
      const concurrent = await Promise.all(
          Array.from({ length: 4 }, () => claim()),
        ),
        claimed = concurrent.filter(Boolean);
      assert.equal(claimed.length, 1);
      let j = claimed[0];
      assert.equal(j.policyVersion, "local-source-policy-1");
      const workerRows = JSON.parse(
        execFileSync(
          "python",
          ["tests/support/youtube-worker-fixture.py", channels[0]],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
        ),
      );
      assert.equal(workerRows[0].videos.length, 5);
      const saved = await checkpoint(j, [channels[0]], workerRows);
      assert.equal(saved.error, null);
      assert.deepEqual(saved.data.completed, [channels[0]]);
      const stored = JSON.parse(
        sql(
          `select jsonb_build_object('metadata',metadata,'videos',videos) from adme_ops.channels where channel_id='${channels[0]}';`,
        ),
      );
      assert.equal(stored.metadata.handle, "@fictional-qa");
      assert.equal(stored.metadata.private_canary, undefined);
      assert.equal(stored.videos[0].views, 0);
      assert.equal(stored.videos[0].likes, null);
      assert.equal(stored.videos.length, 5);
      assert.equal(
        sql(
          `select count(*) from adme_ops.channels where channel_id='${channels[0]}';`,
        ),
        "1",
      );
      assert.equal(
        (
          await worker.rpc("ops_worker_heartbeat", {
            p_token: token,
            p_id: j.id,
            p_lease: j.lease,
          })
        ).data,
        true,
      );
      sql(
        `update adme_ops.jobs set lease_until=now()-interval '1 second' where id='${j.id}';`,
      );
      assert.equal(
        (
          await worker.rpc("ops_worker_heartbeat", {
            p_token: token,
            p_id: j.id,
            p_lease: j.lease,
          })
        ).data,
        false,
      );
      assert.equal((await finish(j)).data, false);
      // A fully committed channel checkpoint is a valid cache hit on restart.
      sql(
        `update adme_ops.jobs set status='queued',lease=null,lease_until=null,available_at=now() where id='${j.id}';`,
      );
      assert.equal(await claim(), null);
      assert.equal(
        sql(`select status from adme_ops.jobs where id='${duplicate}';`),
        "done",
      );
    },
  );
  await check(
    "daily partial checkpoints survive expired leases without repeating completed channels, quota errors use backoff",
    async () => {
      const id = job("youtube_daily", "fictional-recovery-" + randomUUID());
      let j = await claim();
      assert.equal(j.id, id);
      assert.equal(
        (await checkpoint(j, [channels[1], channels[2]], null)).error,
        null,
      );
      assert.equal(
        (await checkpoint(j, [channels[1], channels[2]], [row(channels[1])]))
          .error,
        null,
      );
      assert.ok((await checkpoint(j, [channels[2]], null)).error);
      sql(
        `update adme_ops.jobs set lease_until=now()-interval '1 second' where id='${id}';`,
      );
      const resumed = await claim();
      assert.equal(resumed.id, id);
      assert.notEqual(resumed.lease, j.lease);
      assert.deepEqual(resumed.checkpoint.completed, [channels[1]]);
      assert.equal(
        (
          await checkpoint(
            resumed,
            [channels[1], channels[2]],
            [row(channels[2])],
          )
        ).error,
        null,
      );
      assert.equal((await finish(resumed, "QUOTA")).data, true);
      assert.equal(
        sql(
          `select status||':'||(available_at>now()+interval '11 hours') from adme_ops.jobs where id='${id}';`,
        ),
        "queued:true",
      );
      sql(`update adme_ops.jobs set available_at=now() where id='${id}';`);
      j = await claim();
      assert.equal(j.id, id);
      assert.equal(j.checkpoint.completed.length, 2);
      assert.equal((await finish(j)).data, true);
    },
  );
  await check(
    "policy TTL hides expired cache and public creator references never contain an Auth UID",
    async () => {
      const legacy = "user-" + owner,
        p = JSON.parse(readFileSync("fixtures/creators.demo.json", "utf8"))[0];
      sql(
        `insert into public.creators(id,owner_id,published,profile) values('${legacy}','${owner}',true,'${JSON.stringify({ ...p, is_demo: false, name: "가상 queue 공개", owner_consent: true }).replaceAll("'", "''")}');insert into adme_ops.channel_claims(channel_id,owner_id,verified_at,consent_at)values('${channels[1]}','${owner}',now(),now());update adme_ops.channels set review='accepted' where channel_id='${channels[1]}';`,
      );
      const pub = await worker.rpc("ops_public_channels", { p_query: "" });
      assert.equal(pub.error, null);
      assert.ok(pub.data.some((x) => x.channel_id === channels[1]));
      assert.ok(!JSON.stringify(pub.data).includes(owner));
      const featured = await worker.rpc("featured_youtube", {
        p_query: "",
        p_id: channels[1],
        p_limit: 1,
      });
      assert.equal(featured.error, null);
      assert.equal(featured.data.length, 1);
      assert.ok(!JSON.stringify(featured.data).includes(owner));
      assert.equal(
        (
          await worker.rpc("creator_youtube_channel", {
            p_creator_id: featured.data[0].creator_id,
          })
        ).data,
        channels[1],
      );
      sql(
        `update adme_ops.channels set expires_at=now()-interval '1 second' where channel_id='${channels[1]}';`,
      );
      assert.equal(
        (await worker.rpc("ops_public_channels", { p_query: "" })).data.some(
          (x) => x.channel_id === channels[1],
        ),
        false,
      );
      assert.deepEqual(
        (
          await worker.rpc("featured_youtube", {
            p_query: "",
            p_id: channels[1],
            p_limit: 1,
          })
        ).data,
        [],
      );
    },
  );
  await check(
    "service-only deletion tombstone cancels leases and blocks both cache and normalized identity reintroduction",
    async () => {
      const id = job("youtube_channel", channels[3]),
        j = await claim();
      assert.equal(j.id, id);
      const args = {
        p_channel: channels[3],
        p_request: randomUUID(),
        p_policy: "local-source-policy-1",
      };
      assert.equal(
        (await worker.rpc("ingestion_forget_channel", args)).error?.code,
        "42501",
      );
      assert.equal(
        (
          await localClient(undefined, localJwt(owner)).rpc(
            "ingestion_forget_channel",
            args,
          )
        ).error?.code,
        "42501",
      );
      assert.equal(
        (await service.rpc("ingestion_forget_channel", args)).error,
        null,
      );
      assert.equal((await finish(j)).data, false);
      assert.ok((await checkpoint(j, [channels[3]], [row(channels[3])])).error);
      assert.throws(() =>
        sql(
          `insert into adme_ops.channels(channel_id,title,videos)values('${channels[3]}','가상 재유입','[]');`,
        ),
      );
      assert.throws(() =>
        sql(
          `insert into adme_creator.identities(creator_id,provider,external_id,display_name,canonical_url,observed_at,source_type,policy_version)select r.id,'youtube','${channels[3]}','가상 재유입','https://www.youtube.com/channel/${channels[3]}',now(),'official_api','fictional-only' from adme_creator.records r where legacy_creator_id='user-${owner}';`,
        ),
      );
      assert.equal(
        sql(
          `select count(*) from adme_ops.source_tombstones where resource_hash=adme_ops.resource_hash('${channels[3]}');`,
        ),
        "1",
      );
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          sql(
            `select has_table_privilege('${role}','adme_ops.source_runtime_policies','update');`,
          ),
          "f",
        );
    },
  );
  await check(
    "small daily budgets defer unaffordable jobs without invalid quota costs or provider spend",
    async () => {
      const id = job("youtube_channel", channels[4]);
      sql(
        "update adme_ops.source_runtime_policies set daily_units=2 where version='local-source-policy-1';",
      );
      const before = sql(
        "select coalesce(sum(used),0) from adme_ops.rate_windows where scope='provider_day' and subject='youtube';",
      );
      assert.equal(await claim(), null);
      assert.equal(
        sql(`select error_code from adme_ops.jobs where id='${id}';`),
        "SOURCE_BUDGET_INSUFFICIENT",
      );
      assert.equal(
        sql(
          "select coalesce(sum(used),0) from adme_ops.rate_windows where scope='provider_day' and subject='youtube';",
        ),
        before,
      );
      sql(
        "update adme_ops.source_runtime_policies set daily_units=1000 where version='local-source-policy-1';",
      );
    },
  );
  await check(
    "separate search rolling24h quota blocks a second search and never counts a resume as a new search",
    async () => {
      sql(
        "delete from adme_ops.rate_windows where scope='source_search_24h' and subject='youtube';update adme_ops.source_runtime_policies set search_calls_24h=1 where version='local-source-policy-1';",
      );
      const one = job("youtube_daily", "fictional-search-one-" + randomUUID()),
        j = await claim();
      assert.equal(j.id, one);
      assert.equal((await checkpoint(j, [], null)).error, null);
      assert.equal((await finish(j)).data, true);
      const two = job("youtube_daily", "fictional-search-two-" + randomUUID());
      assert.equal(await claim(), null);
      assert.equal(
        sql(`select error_code from adme_ops.jobs where id='${two}';`),
        "SOURCE_SEARCH_BUDGET",
      );
      assert.equal(
        sql(
          "select sum(used) from adme_ops.rate_windows where scope='source_search_24h' and subject='youtube';",
        ),
        "1",
      );
    },
  );
} finally {
  sql(
    "delete from adme_ops.rate_windows where scope='source_search_24h' and subject='youtube';update adme_ops.source_runtime_policies set search_calls_24h=5 where version='local-source-policy-1';",
  );
  for (const r of previousSearch)
    sql(
      `insert into adme_ops.rate_windows(scope,subject,window_start,used)values('source_search_24h','youtube','${r.window_start}',${r.used});`,
    );
  sql(
    "update adme_ops.source_runtime_policies set daily_units=1000 where version='local-source-policy-1';",
  );
  sql(
    `delete from adme_ops.jobs where owner_id='${owner}';delete from adme_ops.channel_claims where owner_id='${owner}';delete from adme_ops.channels where channel_id in(${channels.map((c) => `'${c}'`).join(",")});delete from adme_ops.source_tombstones where resource_hash in(${channels.map((c) => `adme_ops.resource_hash('${c}')`).join(",")});delete from public.creators where owner_id='${owner}';delete from adme_ops.rate_windows where subject='${owner}';delete from auth.users where id='${owner}';update adme_ops.settings set worker_hash=${previous.worker ? `decode('${previous.worker}','hex')` : "null"};update adme_ops.resource_controls set ingestion_enabled=${previous.ingestion};delete from adme_ops.rate_windows where scope='provider_day' and subject='youtube';`,
  );
  for (const r of previous.budget)
    sql(
      `insert into adme_ops.rate_windows(scope,subject,window_start,used)values('provider_day','youtube','${r.window_start}',${r.used});`,
    );
  for (const j of previous.queued)
    sql(
      `update adme_ops.jobs set available_at='${j.available}' where id='${j.id}' and status='queued';`,
    );
}
writeFileSync(
  "output/dev-a-db/ingestion-recovery-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      results,
      scope:
        "Actual isolated SQL/PostgREST queue, synthetic provider results/role tokens, fictional source policy. No external provider call, cron setup or normalized writer success claim.",
    },
    null,
    2,
  ),
);
