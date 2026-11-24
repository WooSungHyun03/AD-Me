import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { recruitmentFixture } from "./support/local-recruitment.mjs";
import { localClient, sql } from "./support/local-qa.mjs";
const f = await recruitmentFixture();
async function application() {
  const campaign = await f.campaign("상태 전이");
  const r = await f.creators[0].db.rpc("marketplace_action", {
    p_action: "apply",
    p_campaign: campaign.id,
    p_pitch: "가상 상태 전이 검증 지원 메시지입니다.",
  });
  assert.equal(r.error, null);
  return r.data.id;
}
const decide = (db, id, action, key = randomUUID()) =>
  db.rpc("transition_proposal_request", {
    p_id: id,
    p_action: action,
    p_expected: "pending",
    p_key: key,
  });
const count = (table, id) =>
  sql(
    `select count(*)from ${table} where ${table === "public.audit_log" ? "entity_id" : "proposal_id"}='${id}'`,
  );
try {
  const cancel = await application(),
    key = randomUUID();
  const once = await Promise.all([
    decide(f.creators[0].db, cancel, "cancelled", key),
    decide(f.creators[0].db, cancel, "cancelled", key),
  ]);
  assert.ok(once.every((r) => !r.error && r.data === "cancelled"));
  assert.equal(count("public.proposal_events", cancel), "2");
  assert.equal(count("public.notifications", cancel), "2");
  assert.equal(count("adme_ops.proposal_action_receipts", cancel), "1");
  assert.equal(
    (await decide(f.creators[0].db, cancel, "accepted", key)).error?.code,
    "40001",
  );
  assert.equal(
    (await decide(f.brand.db, cancel, "accepted")).error?.code,
    "40001",
  );
  assert.ok((await decide(f.other.db, cancel, "cancelled", key)).error);
  assert.ok((await decide(localClient(), cancel, "cancelled", key)).error);
  console.log(
    "PASS sender cancellation and concurrent same-key replay produce exactly one transition/event/notification/receipt; stale/conflicting/foreign/anon denied",
  );
  const race = await application(),
    before = count("public.proposal_events", race);
  const outcomes = await Promise.all([
    decide(f.brand.db, race, "accepted"),
    decide(f.brand.db, race, "rejected"),
  ]);
  assert.equal(outcomes.filter((r) => !r.error).length, 1);
  assert.equal(outcomes.filter((r) => r.error?.code === "40001").length, 1);
  assert.equal(
    Number(count("public.proposal_events", race)),
    Number(before) + 1,
  );
  assert.equal(count("adme_ops.proposal_action_receipts", race), "1");
  assert.equal(count("public.notifications", race), "2");
  console.log(
    "PASS accept/reject race has one winner; losing transaction leaves no receipt/event/notification",
  );
  const hidden = await application();
  sql(
    `update public.creators set claim_status='unclaimed' where id='${f.creators[0].creatorId}'`,
  );
  const denied = await decide(f.brand.db, hidden, "accepted");
  assert.match(denied.error?.message ?? "", /creator_unavailable/);
  assert.equal(count("public.proposal_events", hidden), "1");
  assert.equal(count("public.notifications", hidden), "1");
  assert.equal(count("adme_ops.proposal_action_receipts", hidden), "0");
  sql(
    `update public.creators set claim_status='verified' where id='${f.creators[0].creatorId}'`,
  );
  const failed = await decide(f.creators[0].db, hidden, "accepted");
  assert.match(failed.error?.message ?? "", /invalid transition/);
  assert.equal(count("adme_ops.proposal_action_receipts", hidden), "0");
  const campaign = await f.campaign("브랜드 제안", {
    job: false,
    window: null,
  });
  const sent = await f.brand.db.rpc("create_creator_proposal", {
    p_campaign: campaign.id,
    p_creator: f.creators[0].creatorId,
    p_kind: "proposal",
    p_brief: "가상 브랜드의 협업 제안 내용입니다.",
  });
  assert.equal(sent.error, null);
  assert.equal(
    (await decide(f.creators[0].db, sent.data, "accepted")).data,
    "accepted",
  );
  assert.equal(
    (
      await f.other.db
        .from("proposal_events")
        .select("id")
        .eq("proposal_id", sent.data)
    ).data.length,
    0,
  );
  assert.ok(
    (
      await f.brand.db.from("proposal_events").insert({
        proposal_id: sent.data,
        actor_id: f.brand.id,
        recipient_id: f.creators[0].id,
        to_status: "completed",
      })
    ).error,
  );
  assert.ok(
    (
      await f.brand.db
        .schema("adme_ops")
        .from("proposal_action_receipts")
        .select("*")
    ).error,
  );
  console.log(
    "PASS unclaimed/wrong-side decisions roll back; verified creator accepts brand proposal; history is participant-only and cannot be forged; receipts private",
  );
  const blocked = await application();
  sql(
    `insert into public.user_blocks(blocker_id,blocked_id)values('${f.brand.id}','${f.creators[0].id}')`,
  );
  try {
    assert.match(
      (await decide(f.brand.db, blocked, "accepted")).error?.message ?? "",
      /blocked/,
    );
    assert.equal(count("public.proposal_events", blocked), "1");
    assert.equal(count("adme_ops.proposal_action_receipts", blocked), "0");
  } finally {
    sql(
      `delete from public.user_blocks where blocker_id='${f.brand.id}' and blocked_id='${f.creators[0].id}'`,
    );
  }
  const suspended = await application(),
    restriction = randomUUID();
  sql(
    `insert into public.contact_restrictions(id,user_id,reason,ends_at,created_by) values('${restriction}','${f.creators[0].id}','가상 운영 제한 검증',now()+interval'1 hour','${f.other.id}')`,
  );
  try {
    assert.match(
      (await decide(f.brand.db, suspended, "accepted")).error?.message ?? "",
      /contact_restricted/,
    );
    assert.match(
      (
        await f.brand.db.rpc("transition_proposal", {
          p_id: suspended,
          p_action: "accepted",
        })
      ).error?.message ?? "",
      /contact_restricted/,
    );
    assert.equal(count("public.proposal_events", suspended), "1");
    assert.equal(count("adme_ops.proposal_action_receipts", suspended), "0");
  } finally {
    sql(`delete from public.contact_restrictions where id='${restriction}'`);
  }
  console.log(
    "PASS blocked and contact-suspended counterpart cannot be accepted; no transition receipt or extra history",
  );
  const moderated = await application();
  sql(
    `update public.creators set moderation_status='restricted' where id='${f.creators[0].creatorId}'`,
  );
  try {
    assert.match(
      (
        await f.brand.db.rpc("transition_proposal", {
          p_id: moderated,
          p_action: "accepted",
        })
      ).error?.message ?? "",
      /creator_unavailable/,
    );
    assert.equal(count("public.proposal_events", moderated), "1");
  } finally {
    sql(
      `update public.creators set moderation_status='allowed' where id='${f.creators[0].creatorId}'`,
    );
  }
  console.log(
    "PASS legacy acceptance RPC also denies moderated counterpart without changing history",
  );
} finally {
  await f.cleanup();
}
