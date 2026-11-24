import assert from "node:assert/strict";
import { recruitmentFixture } from "./support/local-recruitment.mjs";
import { localClient, sql } from "./support/local-qa.mjs";
const f = await recruitmentFixture();
const apply = (c, job) =>
  c.db.rpc("marketplace_action", {
    p_action: "apply",
    p_campaign: job.id,
    p_pitch: "가상 채널에서 제품 리뷰를 제작하겠습니다.",
  });
try {
  const future = await f.campaign("모집 예정", { window: f.terms(10, 20) });
  const before = await apply(f.creators[0], future);
  if (process.argv.includes("--before")) {
    assert.equal(before.error, null);
    console.log(
      "REPRODUCED: future structured recruitment accepted by marketplace RPC",
    );
    process.exitCode = 0;
  } else {
    assert.equal(before.error?.code, "PT409");
    const expired = await f.campaign("모집 종료", {
      window: f.terms(-20, -10),
    });
    assert.equal((await apply(f.creators[0], expired)).error?.code, "PT409");
    const legacy = await f.campaign("기존 마감", { window: null, job: false });
    sql(
      `update public.campaigns set recruit_until=now()-interval'1 second' where id='${legacy.id}'`,
    );
    const legacyApply = () =>
      f.creators[0].db.rpc("create_creator_proposal", {
        p_campaign: legacy.id,
        p_creator: f.creators[0].creatorId,
        p_kind: "application",
        p_brief: "기존 경로의 가상 지원 메시지입니다.",
      });
    assert.equal((await legacyApply()).error?.code, "PT409");
    console.log(
      "PASS future/end/legacy deadline denied across marketplace and legacy RPC",
    );
    const open = await f.campaign("현재 모집", { capacity: 1 });
    const same = await Promise.all([
      apply(f.creators[0], open),
      apply(f.creators[0], open),
    ]);
    assert.ok(
      same.every((r) => !r.error),
      JSON.stringify(same.map((r) => r.error?.message)),
    );
    assert.equal(same[0].data.id, same[1].data.id);
    const second = await apply(f.creators[1], open);
    assert.equal(second.error, null);
    const race = await Promise.all(
      [same[0].data.id, second.data.id].map((id) =>
        f.brand.db.rpc("transition_proposal", {
          p_id: id,
          p_action: "accepted",
        }),
      ),
    );
    assert.equal(race.filter((r) => !r.error).length, 1);
    assert.ok(race.some((r) => r.error?.message === "capacity_full"));
    assert.equal((await apply(f.creators[2], open)).error?.code, "PT409");
    assert.equal((await apply(f.creators[0], open)).data.id, same[0].data.id);
    const closed = await f.brand.db.rpc("marketplace_action", {
      p_action: "close",
      p_campaign: open.id,
    });
    assert.equal(closed.error, null);
    assert.ok((await apply(f.creators[2], open)).error);
    assert.equal((await apply(f.creators[0], open)).data.id, same[0].data.id);
    assert.equal(
      sql(
        `select count(*)from public.proposals where campaign_id='${open.id}'`,
      ),
      "2",
    );
    console.log(
      "PASS same-account concurrent retry inserts once; capacity race exactly1; full/closed deny new support, historical retry preserved",
    );
    for (const db of [f.brand.db, f.other.db, localClient()])
      assert.ok(
        (
          await db.rpc("marketplace_action", {
            p_action: "apply",
            p_campaign: future.id,
            p_pitch: "권한이 없는 가상 지원 요청입니다.",
          })
        ).error,
      );
    assert.ok(
      (
        await f.other.db.rpc("marketplace_action", {
          p_action: "close",
          p_campaign: future.id,
        })
      ).error,
    );
    const privateJob = await f.campaign("비공개 초안", { status: "draft" });
    assert.deepEqual(
      (await f.other.db.rpc("marketplace_board", { p_id: privateJob.id })).data,
      [],
    );
    const bounded = await f.campaign("경계 검사");
    assert.equal(
      sql(
        `select adme_ops.campaign_accepting_at(c,(c.brief#>>'{terms,recruitment,start}')::timestamptz)||','||adme_ops.campaign_accepting_at(c,(c.brief#>>'{terms,recruitment,end}')::timestamptz) from public.campaigns c where id='${bounded.id}'`,
      ),
      "true,false",
    );
    const raw = await f.campaign("기존 비공개", {
      job: false,
      capacity: 2,
      window: null,
    });
    const proposal = await f.creators[0].db.rpc("create_creator_proposal", {
      p_campaign: raw.id,
      p_creator: f.creators[0].creatorId,
      p_kind: "application",
      p_brief: "가상 기존 캠페인의 지원 메시지입니다.",
    });
    assert.equal(proposal.error, null);
    const hide = await f.brand.db
      .from("campaigns")
      .update({ status: "draft" })
      .eq("id", raw.id);
    assert.match(hide.error?.message ?? "", /has_active_proposals/);
    assert.ok(
      (
        await f.other.db.rpc("transition_proposal", {
          p_id: proposal.data,
          p_action: "accepted",
        })
      ).error,
    );
    console.log(
      "PASS opposite roles/foreign brand/private draft denied; DB half-open boundary; active application prevents private transition",
    );
  }
} finally {
  await f.cleanup();
}
