// Local-only reviewed67->68 packet; does not link/apply/deploy to a hosted project.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { localRuntime, sql } from "../tests/support/local-qa.mjs";
localRuntime();
const baseline = "3a3f09f77f24b66321d61f18b5105e430234699a";
const old = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", baseline, "supabase/migrations"],
  { encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/);
assert.equal(old.length, 67);
const versions = old.map((p) => p.split("/").at(-1).split("_")[0]).sort();
const history = JSON.parse(
  sql(
    "select jsonb_agg(jsonb_build_object('version',version,'hash',md5(coalesce(statements::text,'')))order by version)from supabase_migrations.schema_migrations where version<>'202611220068';",
  ),
);
assert.deepEqual(history.map((x) => x.version).sort(), versions);
// A known CLI baseline splits statements into text[]; earlier USER packets retain one full SQL string.
// Compare exact compiled function definitions/ACLs in both marked QA databases before admitting either hash.
assert.match(
  readFileSync("output/dev-a-packet-db/supabase/config.toml", "utf8"),
  /^project_id = "dev-a-packet-db"$/m,
);
const packetSql = (input) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_dev-a-packet-db",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
const metadataSql =
  "select jsonb_agg(jsonb_build_object('sig',p.oid::regprocedure::text,'hash',md5(replace(pg_get_functiondef(p.oid),E'\\r\\n',E'\\n')),'anon',has_function_privilege('anon',p.oid,'execute'),'auth',has_function_privilege('authenticated',p.oid,'execute'),'service',has_function_privilege('service_role',p.oid,'execute'))order by p.oid::regprocedure::text)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='public'or n.nspname like'adme_%')and n.nspname<>'adme_search'and p.proname not like'saved_search_%';";
const metadata = JSON.parse(sql(metadataSql));
assert.deepEqual(
  JSON.parse(packetSql(metadataSql)),
  metadata,
  "Different baseline function definitions/ACLs require independent review",
);
const alternate = JSON.parse(
  packetSql(
    "select jsonb_agg(jsonb_build_object('version',version,'hash',md5(coalesce(statements::text,'')))order by version)from supabase_migrations.schema_migrations;",
  ),
);
assert.deepEqual(alternate.map((x) => x.version).sort(), versions);
const functions = [
  "public.account_access()",
  "adme_ops.require_quota(text,text,integer,integer,integer)",
];
const signatures = functions.map((signature) => ({
  signature,
  hash: sql(
    `select md5(replace(pg_get_functiondef('${signature}'::regprocedure),E'\\r\\n',E'\\n'));`,
  ),
}));
const gate = `do $$begin
 if(select count(*)from supabase_migrations.schema_migrations)<>67 then raise exception 'STOP: exact67 baseline required';end if;
 ${history
   .map((h) => {
     const other = alternate.find((x) => x.version === h.version);
     return `if not exists(select 1 from supabase_migrations.schema_migrations where version='${h.version}'and md5(coalesce(statements::text,''))in('${h.hash}','${other.hash}'))then raise exception 'STOP: changed baseline source/format ${h.version}';end if;`;
   })
   .join("\n ")}
 if exists(select 1 from pg_namespace where nspname='adme_search')then raise exception 'STOP: saved search schema already exists';end if;
 ${signatures.map((f) => `if md5(replace(pg_get_functiondef('${f.signature}'::regprocedure),E'\\r\\n',E'\\n'))<>'${f.hash}'then raise exception 'STOP: reviewed dependency function required';end if;`).join("\n ")}
 if not exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig)c(value)where r.rolname='authenticator'and c.value='pgrst.db_pre_request=adme_privacy.enforce_actor')or exists(select 1 from pg_db_role_setting s cross join lateral unnest(s.setconfig)c(value)where c.value like'pgrst.db_pre_request=%'and c.value<>'pgrst.db_pre_request=adme_privacy.enforce_actor')then raise exception 'STOP: custom DataAPI hook requires review';end if;
end$$;\n`;
const path = "supabase/migrations/202611220068_saved_searches.sql",
  source = readFileSync(path, "utf8").replaceAll("\r\n", "\n");
assert.equal((source.match(/^begin;$/gm) ?? []).length, 1);
assert.equal((source.match(/^commit;$/gm) ?? []).length, 1);
const body = source.replace(/^begin;\s*$/m, "").replace(/^commit;\s*$/m, "");
const target = "deliverables/dev-a-independent-20261122";
assert.ok(
  !existsSync(`${target}/MANIFEST.json`),
  "Existing delivery remains immutable; choose a new packet revision",
);
mkdirSync(target, { recursive: true });
const files = {
  "00_preflight.sql": gate,
  "01_apply_current_67.sql": `begin;\nset local lock_timeout='5s';\nset local statement_timeout='60s';\nselect pg_advisory_xact_lock(hashtext('adme-independent-20261122'));\n${gate}\n${body}\ninsert into supabase_migrations.schema_migrations(version,name,statements)values('202611220068','saved_searches',array[$independent_source$${source}$independent_source$]);\ncommit;\n`,
  "02_verify.sql":
    "select count(*)from supabase_migrations.schema_migrations; --68\nselect relrowsecurity from pg_class where oid='adme_search.saved_conditions'::regclass; --true\nselect has_schema_privilege('authenticated','adme_search','usage'),has_table_privilege('authenticated','adme_search.saved_conditions','select'),has_function_privilege('anon','public.saved_search_list()','execute'); --all false\nselect enabled from adme_privacy.intake; --no change\n",
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const [name, content] of Object.entries(files))
  writeFileSync(`${target}/${name}`, content);
writeFileSync(
  `${target}/MANIFEST.json`,
  JSON.stringify(
    {
      source_head: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      baseline,
      from_migrations: 67,
      to_migrations: 68,
      sources: [{ path, sha256_lf: hash(source) }],
      files: Object.entries(files).map(([path, content]) => ({
        path,
        sha256_lf: hash(content),
      })),
      external_applied: false,
      activation_included: false,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  `${target}/README.md`,
  `# USER 적용 패킷 — 독립 구현\n\n정확히 검토된67개 migration 이력에서68(저장 검색)만 추가합니다. main의8개 이력에 바로 적용하지 않습니다. 이전 패킷과 적용 DB의 source/history가 다르면 중지하고 개발자가 호환성을 검토합니다. 기존 자료·migration·권한은 변경하지 않으며 새 private 검색 조건 schema/RPC만 추가합니다.\n\nUSER가 Supabase SQL Editor에서00_preflight.sql을 확인하고01_apply_current_67.sql을 한 번 적용한 뒤02_verify.sql을 확인합니다. 사용자가 소스 수정/터미널/패키지 설치를 할 필요는 없습니다. 오류는 전체 트랜잭션을 롤백하며 재적용/변경 이력/커스텀 hook은 STOP합니다. 성공 후 되돌림이 필요하면 기능 접근을 중단하고 개발자 forward fix를 사용합니다. 실제 저장 검색 자료를 DROP하지 않습니다.\n\n알림·크롤러·Instagram·팀·추천 실험은 활성화하지 않습니다. 별도 API키/새 환경 변수는 없습니다. main과 A branch Git 배포 hold를 유지하고 USER가 DB/설정을 맞춘 뒤 배포를 조율합니다. 이 패킷은 배포하지 않으며 정책·보존·DEV-B 교차 검토·실제 공급자 검증 완료를 뜻하지 않습니다.\n`,
);
console.log(
  "Prepared one immutable reviewed67->68 USER packet; no external apply.",
);
