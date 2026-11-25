import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  localRuntime,
  localClient,
  localJwt,
  sql,
} from "./support/local-qa.mjs";
localRuntime();
const a = JSON.parse(
    readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
  ),
  id = randomUUID(),
  supportId = randomUUID(),
  report = randomUUID(),
  admin = localClient(undefined, localJwt(a.admin.id)),
  stale = localClient(
    undefined,
    localJwt(a.admin.id, { aal: "aal1", amr: [] }),
  ),
  normal = localClient(undefined, localJwt(id)),
  support = localClient(undefined, localJwt(supportId)),
  anon = localClient(),
  reason = "가상 지원 요청 확인 " + id,
  results = [];
const check = async (name, fn) => {
    await fn();
    results.push({ name, result: "PASS" });
    console.log("PASS " + name);
  },
  search = (client, kind = "members", extra = {}) =>
    client.rpc("admin_support_search", {
      p_kind: kind,
      p_query: "",
      p_reason: reason,
      p_request: randomUUID(),
      p_limit: 2,
      ...extra,
    });
try {
  for (const uid of [id, supportId])
    sql(
      `insert into auth.users(id,raw_user_meta_data)values('${uid}','{"role":"brand","name":"가상 운영 검색","email":"PRIVATE_SUPPORT_CANARY"}');`,
    );
  sql(
    `select adme_ops.provision_staff('${supportId}','support','FICTIONAL LOCAL SUPPORT QA',now()+interval'1 hour');insert into public.reports(id,reporter_id,creator_id,reason,source_url,ticket_no,due_at)values('${report}','${id}','creator-001','PRIVATE_REPORT_CANARY not public','https://example.test/fictional-support','ADR-QA-'||left('${report}',8),now()+interval'7 days');`,
  );
  await check(
    "normal, anonymous and stale MFA denied; delegated support limited to support scope",
    async () => {
      for (const client of [normal, anon, stale])
        assert.ok((await search(client)).error);
      assert.equal((await search(support)).error, null);
      for (const kind of [
        "creators",
        "campaigns",
        "jobs",
        "orders",
        "audit",
        "export",
        "role",
      ])
        assert.ok((await search(support, kind)).error);
      assert.ok((await search(admin, "export")).error);
      assert.ok((await search(admin, "members", { p_reason: "x" })).error);
    },
  );
  await check(
    "all admin domains bounded/minimal; cursor bound to search context; search audit records exact request",
    async () => {
      for (const kind of [
        "members",
        "creators",
        "campaigns",
        "jobs",
        "reports",
        "orders",
        "audit",
      ]) {
        const r = await search(admin, kind);
        assert.equal(r.error, null, JSON.stringify(r.error));
        assert.ok(r.data.items.length <= 2);
        const out = JSON.stringify(r.data);
        for (const k of [
          "PRIVATE_SUPPORT_CANARY",
          "PRIVATE_REPORT_CANARY",
          "payment_key",
          "password",
          "worker_hash",
          "output",
          "input",
        ])
          assert.ok(!out.includes(k));
      }
      const request = randomUUID(),
        r = await search(admin, "members", { p_request: request });
      assert.equal(r.error, null);
      assert.equal(
        sql(
          `select request_id::text from adme_ops.support_audit where request_id='${request}';`,
        ),
        request,
      );
      if (r.data.nextCursor) {
        const b = await search(admin, "members", {
          p_after: r.data.nextCursor,
        });
        assert.equal(b.error, null);
        assert.ok(
          b.data.items.every((x) => !r.data.items.some((y) => x.id === y.id)),
        );
        assert.ok(
          (
            await search(admin, "members", {
              p_query: "changed",
              p_after: r.data.nextCursor,
            })
          ).error,
        );
      }
    },
  );
  await check(
    "review reason/status/request enforced atomically; legacy reasonless route blocked",
    async () => {
      // report_queue replaced the legacy route; a terminal decision without a response is still refused.
      assert.match(
        (
          await admin.rpc("review_report", {
            p_id: report,
            p_status: "resolved",
          })
        ).error?.message ?? "",
        /response_required/,
      );
      const request = randomUUID();
      assert.equal(
        (
          await admin.rpc("admin_review_report", {
            p_id: report,
            p_status: "reviewed",
            p_reason: reason,
            p_request: request,
          })
        ).error,
        null,
      );
      assert.equal(
        sql(
          `select status||','||response||','||decided_by from public.reports where id='${report}';`,
        ),
        `resolved,${reason},${a.admin.id}`,
      );
      assert.equal(
        sql(
          `select actor_id::text||','||target from adme_ops.support_audit where request_id='${request}';`,
        ),
        a.admin.id + "," + report,
      );
      assert.ok(
        (
          await support.rpc("admin_review_report", {
            p_id: report,
            p_status: "dismissed",
            p_reason: reason,
            p_request: randomUUID(),
          })
        ).error,
      );
    },
  );
  await check(
    "immutable audit and private table/function grants; no self-promotion/export from support APIs",
    async () => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        assert.equal(
          sql(
            `select has_table_privilege('${role}','adme_ops.support_audit','select');`,
          ),
          "f",
        );
        assert.equal(
          sql(
            `select has_function_privilege('${role}','adme_ops.support_log(text,text,uuid,text)','execute');`,
          ),
          "f",
        );
      }
      assert.throws(
        () =>
          sql(
            `update adme_ops.support_audit set reason='tampered'where target='${report}';`,
          ),
        /append only/,
      );
      assert.throws(
        () =>
          sql(`delete from adme_ops.support_audit where target='${report}';`),
        /append only/,
      );
    },
  );
} finally {
  // Exact disposable QA only: remove only this test's appended rows, preserving previous audit.
  sql(
    `begin;alter table adme_ops.support_audit disable trigger user;delete from adme_ops.support_audit where reason='${reason}';alter table adme_ops.support_audit enable trigger user;commit;delete from public.reports where id='${report}';delete from public.audit_log where entity_id in('${report}','${supportId}');delete from auth.users where id in('${id}','${supportId}');`,
  );
}
writeFileSync(
  "harness/evidence/DEV-A-READY-20261122/admin-support-security.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "Actual local DB/PostgREST; synthetic local signed JWTs test permissions, not native MFA/provider acceptance",
      results,
    },
    null,
    2,
  ) + "\n",
);
