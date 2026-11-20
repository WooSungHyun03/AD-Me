import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import {
  localClient,
  localJwt,
  localRuntime,
  sql,
} from "../support/local-qa.mjs";
import {
  legacyCreatorCompatibility,
  readOwnCreatorIdentitySnapshot,
} from "@/lib/ingestion/creator-storage";
import { creatorPublicIdentity } from "@/lib/ingestion/creator-contract";

it("validates the actual local RPC/SQL representation through the server adapter without replacing missing metrics", async () => {
  localRuntime(); // Reject hosted URLs before SQL, signing or client creation.
  const owner = randomUUID(),
    identity = randomUUID();
  const legacy = `user-${owner}`;
  try {
    sql(`insert into auth.users(id,raw_user_meta_data) values('${owner}','{"role":"creator","name":"가상 저장 계약 QA"}');
      insert into public.creators(id,owner_id,published,profile) select '${legacy}','${owner}',false,profile from public.creators where id='creator-001';
      insert into adme_creator.identities(id,creator_id,provider,external_id,display_name,canonical_url,observed_at,source_type,policy_version)
        select '${identity}',id,'youtube','fictional-${identity}','가상 계약 QA','https://example.org/fictional','2026-11-20T00:00:00Z','synthetic_demo','fixture-not-approved' from adme_creator.records where legacy_creator_id='${legacy}';
      insert into adme_creator.metric_observations(identity_id,name,value,unit,observed_at,source_url,policy_version,kind) values
        ('${identity}','followers',null,'count','2026-11-19T00:00:00Z','https://example.org/fictional','fixture-not-approved','original'),
        ('${identity}','followers',0,'count','2026-11-20T00:00:00Z','https://example.org/fictional','fixture-not-approved','original');`);
    const client = localClient(undefined, localJwt(owner));
    const snapshot = await readOwnCreatorIdentitySnapshot(client);
    expect(snapshot?.legacyCreatorId).toBe(legacy);
    expect(snapshot?.identities[0].identity.ownerId).toBe(owner);
    expect(snapshot?.identities[0].metrics.map((m) => m.value)).toEqual([
      0,
      null,
    ]);
    expect(snapshot?.identities[0].metrics[0].observedAt).toBe(
      "2026-11-20T00:00:00+00:00",
    );
    const compatible = legacyCreatorCompatibility(snapshot!);
    expect(compatible.profile.followers).toBe(2500);
    expect(compatible.normalized[0].identity.isDemo).toBe(true);
    expect(compatible.truncated).toBe(false);
    expect(
      creatorPublicIdentity(
        compatible.normalized[0].identity,
        compatible.normalized[0].metrics,
      ),
    ).toBeNull();
    sql(`delete from public.creators where id='${legacy}';`);
    expect(await readOwnCreatorIdentitySnapshot(client)).toBeNull();
  } finally {
    sql(
      `delete from public.creators where id='${legacy}'; delete from auth.users where id='${owner}';`,
    );
  }
}, 15000);
