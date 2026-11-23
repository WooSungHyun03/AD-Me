import { execFileSync } from "node:child_process";
import type { Page } from "@playwright/test";

export const isolatedYoutube = process.env.ADME_E2E_ISOLATED_YOUTUBE === "1";
const liveNames = ["쯔양", "PONY Syndrome", "RISABAE"];
const ids = [
  "UCfpaSruWW3S4dibonKXENjA",
  "UCT-_4GqC-yLY1xtTHhwY0hA",
  "UC9kmlDcqksaOnCkC_qzGacA",
];
export const channels = ids.map((id, index) => ({
  id,
  name: isolatedYoutube
    ? `QA YouTube 채널 ${String(index + 1).padStart(2, "0")}`
    : liveNames[index],
}));

export async function routeYoutubeImages(page: Page) {
  if (!isolatedYoutube) return;
  await page.route(
    /^https:\/\/(yt3\.googleusercontent\.com|i\.ytimg\.com)\/adme-e2e\//,
    (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#d7ff45"/></svg>',
      }),
  );
}

export function finishLocalWorkerJob(
  kind: "marketing_draft" | "youtube_claim",
) {
  if (!isolatedYoutube) return;
  const outputs = {
    marketing_draft: {
      concept: "유튜브 광고 초안",
      outline: ["사용 장면"],
      proposal: "테스트 협업 제안",
      model: "isolated-fixture",
    },
    youtube_claim: { verified: false },
  };
  const output = JSON.stringify(outputs[kind]);
  const result = execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_AD-Me",
      "psql",
      "-U",
      "postgres",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      `job_kind=${kind}`,
      "-v",
      `job_output=${output}`,
    ],
    {
      input: `select id from adme_ops.jobs where kind=:'job_kind' and status='queued'
      order by created_at desc limit 1 \\gset
      update adme_ops.jobs set status='running', lease=gen_random_uuid(), lease_until=now()+interval '2 minutes'
        , source_policy=(select version from adme_ops.source_runtime_policies where enabled)
      where id=:'id' returning lease \\gset
      select adme_ops.ops_worker_finish(repeat('0',64),:'id',:'lease',:'job_output'::jsonb,null,1);`,
      encoding: "utf8",
    },
  );
  if (result.trim() !== "t")
    throw new Error("No isolated YouTube worker job was completed");
}
