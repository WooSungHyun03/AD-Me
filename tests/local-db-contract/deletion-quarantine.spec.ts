import { it, expect } from "vitest";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import sharp from "sharp";
import { localRuntime, localClient, sql } from "../support/local-qa.mjs";
import {
  enableLocalConsent,
  qaSignupConsent,
} from "../support/consent-fixture.mjs";
import { enableLocalDeletionIntake } from "../support/deletion-fixture.mjs";
import {
  advanceDeletionQuarantine,
  readDeletionStatus,
} from "@/lib/deletion-runtime";
import type { SupabaseClient } from "@supabase/supabase-js";
const runtime = localRuntime(),
  admin = localClient(runtime.SERVICE_ROLE_KEY);
async function fixture() {
  enableLocalConsent();
  const password = randomBytes(24).toString("base64url"),
    email = `deletion-${randomUUID()}@example.test`;
  const made = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { ...qaSignupConsent, role: "brand", name: "가상 삭제 QA" },
  });
  expect(made.error).toBeNull();
  const actor = made.data.user!.id;
  const user = localClient(),
    signed = await user.auth.signInWithPassword({ email, password });
  expect(signed.error).toBeNull();
  const file = randomUUID(),
    input = { id: randomUUID(), receipt: randomBytes(32).toString("hex") },
    path = `${actor}/${file}.png`,
    target = `${input.id}/${file}.png`,
    bytes = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#d7ff45" },
    })
      .png()
      .toBuffer(),
    hash = createHash("sha256").update(bytes).digest("hex");
  sql(
    `insert into adme_upload.files(id,owner_id,purpose,name,sha256,bytes,state)values('${file}','${actor}','brand_logo','가상 파일','${hash}',${bytes.length},'verified');insert into public.brand_profiles(owner_id,brand_name,industry,introduction,published)values('${actor}','가상 삭제 브랜드','교육','가상 자료',true);insert into adme_upload.brand_logos(owner_id,file_id)values('${actor}','${file}');`,
  );
  expect(
    (
      await admin.storage
        .from("adme-private-images")
        .upload(path, bytes, { contentType: "image/png" })
    ).error,
  ).toBeNull();
  const accept = () =>
    admin.rpc("deletion_accept", {
      p_actor: actor,
      p_id: input.id,
      p_receipt: input.receipt,
      p_reauth: new Date().toISOString(),
    });
  return {
    actor,
    input,
    user,
    path,
    target,
    bytes,
    accept,
    async cleanup() {
      await admin.storage.from("adme-private-images").remove([path]);
      await admin.storage.from("adme-privacy-quarantine").remove([target]);
      sql(`delete from adme_ops.jobs where owner_id='${actor}';`);
      sql(
        `delete from adme_privacy.quarantine_files where request_id='${input.id}';delete from adme_privacy.requests where actor_id='${actor}';delete from adme_upload.brand_logos where owner_id='${actor}';delete from adme_upload.files where owner_id='${actor}';delete from public.brand_contacts where owner_id='${actor}';delete from public.brand_profiles where owner_id='${actor}';delete from adme_ops.rate_windows where subject='${actor}';`,
      );
      expect((await admin.auth.admin.deleteUser(actor)).error).toBeNull();
    },
  };
}
it("uses actual Auth/DataAPI/Storage: default-off, stale-JWT denial, verified quarantine, original signed-path removal and retention wait", async () => {
  const f = await fixture();
  try {
    sql("update adme_privacy.intake set enabled=false;");
    const job = randomUUID(),
      channel = "UC" + randomUUID().replaceAll("-", "").slice(0, 22);
    sql(
      `insert into adme_ops.jobs(id,kind,owner_id,input)values('${job}','youtube_channel','${f.actor}','${channel}');update adme_ops.jobs set status='running',lease=gen_random_uuid(),lease_until=now()+interval '5 minutes' where id='${job}';`,
    );
    expect((await f.accept()).error).toBeTruthy();
    expect(await readDeletionStatus(admin, f.input)).toBeNull();
    enableLocalDeletionIntake();
    const signed = await admin.storage
      .from("adme-private-images")
      .createSignedUrl(f.path, 600);
    expect(signed.error).toBeNull();
    expect((await fetch(signed.data!.signedUrl)).status).toBe(200);
    const accepted = await f.accept();
    expect(accepted.error).toBeNull();
    expect(accepted.data.storageRevoked).toBe(false);
    expect(
      sql(
        `select status||':'||(lease is null)::text||':'||error_code from adme_ops.jobs where id='${job}';`,
      ),
    ).toBe("failed:true:ACCOUNT_DELETION");
    expect((await f.user.from("profiles").select("id")).error?.code).toBe(
      "42501",
    );
    expect((await f.user.rpc("my_brand_account")).error?.code).toBe("42501");
    expect(
      (await f.user.storage.from("adme-private-images").download(f.path)).error,
    ).toBeTruthy();
    expect(
      (
        await admin.rpc("deletion_status", {
          p_id: f.input.id,
          p_receipt: "0".repeat(64),
        })
      ).data,
    ).toBeNull();
    const state = await advanceDeletionQuarantine(admin, f.input);
    expect(state?.state).toBe("waiting_retention");
    expect(state?.authRestricted).toBe(true);
    expect(state?.storageRevoked).toBe(true);
    const copy = await admin.storage
      .from("adme-privacy-quarantine")
      .download(f.target);
    expect(copy.error).toBeNull();
    expect(Buffer.from(await copy.data!.arrayBuffer())).toEqual(f.bytes);
    expect((await fetch(signed.data!.signedUrl)).status).toBeGreaterThanOrEqual(
      400,
    );
    const other = localClient();
    expect(
      (await other.storage.from("adme-privacy-quarantine").download(f.target))
        .data,
    ).toBeNull();
    expect((await admin.auth.admin.getUserById(f.actor)).data.user?.id).toBe(
      f.actor,
    ); // Not full deletion.
    expect(
      (
        await admin.storage
          .from("adme-private-images")
          .upload(f.path, f.bytes, { contentType: "image/png" })
      ).error,
    ).toBeTruthy(); // No reintroduction, even through service.
    expect((await advanceDeletionQuarantine(admin, f.input))?.state).toBe(
      "waiting_retention",
    );
  } finally {
    await f.cleanup();
  }
}, 30000);
it("does not claim all file paths revoked when an untracked legacy object needs review", async () => {
  const f = await fixture(),
    path = `${f.actor}/${randomUUID()}.png`;
  try {
    expect(
      (
        await admin.storage
          .from("adme-private-images")
          .upload(path, f.bytes, { contentType: "image/png" })
      ).error,
    ).toBeNull();
    enableLocalDeletionIntake();
    expect((await f.accept()).error).toBeNull();
    const state = await advanceDeletionQuarantine(admin, f.input);
    expect(state?.state).toBe("waiting_review");
    expect(state?.storageRevoked).toBe(false);
    expect(state?.errorCode).toBe("UNRECOGNIZED_STORAGE_OBJECTS");
  } finally {
    await admin.storage.from("adme-private-images").remove([path]);
    await f.cleanup();
  }
}, 30000);
it("recovers a lost checkpoint after actual source removal without losing retained bytes or replaying an expired lease", async () => {
  const f = await fixture();
  try {
    enableLocalDeletionIntake();
    expect((await f.accept()).error).toBeNull();
    let dropped = false;
    const flaky = {
      auth: admin.auth,
      storage: admin.storage,
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (
          name === "deletion_checkpoint" &&
          args.p_phase === "source_removed" &&
          !dropped
        ) {
          dropped = true;
          return { data: null, error: { code: "NETWORK_FIXTURE" } };
        }
        return admin.rpc(name, args);
      },
    } as unknown as SupabaseClient;
    expect((await advanceDeletionQuarantine(flaky, f.input))?.state).toBe(
      "retry_required",
    );
    expect(
      sql(
        `select phase from adme_privacy.quarantine_files where request_id='${f.input.id}';`,
      ),
    ).toBe("copied");
    expect(
      (await admin.storage.from("adme-private-images").download(f.path)).data,
    ).toBeNull();
    sql(
      `update adme_privacy.requests set available_at=now()where id='${f.input.id}';`,
    );
    expect((await advanceDeletionQuarantine(admin, f.input))?.state).toBe(
      "waiting_retention",
    );
    expect(
      (
        await admin.rpc("deletion_checkpoint", {
          p_id: f.input.id,
          p_lease: randomUUID(),
          p_file: null,
          p_phase: "release",
        })
      ).data,
    ).toBe(false);
  } finally {
    await f.cleanup();
  }
}, 30000);
