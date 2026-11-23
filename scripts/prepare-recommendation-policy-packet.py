"""Immutable D045112→113 USER packet; inspect only the marked secondary local DB."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
target = root / 'deliverables/dev-a-recommendation-policy-20261123'
assert not target.exists(), 'Reviewed packet is immutable'
assert 'project_id = "dev-a-packet-db"' in (root/'output/dev-a-packet-db/supabase/config.toml').read_text(encoding='utf-8')

def sql(query):
    return subprocess.check_output(['docker','exec','-i','supabase_db_dev-a-packet-db','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'], input=query, text=True, encoding='utf-8', cwd=root).strip()

assert sql('select count(*)from supabase_migrations.schema_migrations') == '112'
records = []
for path in sorted((root/'supabase/migrations').glob('*.sql')):
    version, name = path.stem.split('_',1)
    body = path.read_text(encoding='utf-8').replace('\r\n','\n')
    records.append(dict(version=version,name=name,sha256=hashlib.sha256(body.encode()).hexdigest(),body=body))
baseline = [r for r in records if r['version'] != '20261123125600']
pending = [r for r in records if r['version'] == '20261123125600']
assert len(baseline) == 112 and len(pending) == 1
signatures = ['adme_privacy.enforce_actor()', 'adme_recommendation.context_unmetered(uuid)',
              'adme_recommendation.context(uuid)', 'adme_recommendation.page(uuid,uuid)',
              'adme_recommendation.create_snapshot(uuid,uuid)', 'adme_recommendation.score_v1(jsonb,jsonb)',
              'adme_creator.catalog_dto(public.creators)']
values = ','.join("'"+s+"'"for s in signatures)
fingerprints = json.loads(sql("select jsonb_object_agg(s,encode(sha256(convert_to(pg_get_functiondef(s::regprocedure),'UTF8')),'hex'))from unnest(array["+values+"])s;"))
history = ',\n'.join(f"('{r['version']}','{r['name']}')"for r in baseline)
functions = ',\n'.join(f"('{s}','{fingerprints[s]}')"for s in signatures)
preflight = f"""-- Reviewed112 versions/names and7 exact critical function definitions; no applied-history rewrite.
do $preflight$ begin
 if to_regprocedure('public.recommendation_create_v12(uuid,uuid,boolean)')is not null then raise exception 'STOP: v12 already exists; inspect partial/repeated application';end if;
 if(select count(*)from supabase_migrations.schema_migrations)<>112 or exists(select 1 from(values {history})e(version,name)left join supabase_migrations.schema_migrations m using(version)where m.version is null or m.name is distinct from e.name)then raise exception 'STOP: unsupported or partial baseline';end if;
 if exists(select 1 from(values {functions})e(signature,hash)where to_regprocedure(e.signature)is null or encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(e.signature)),'UTF8')),'hex')is distinct from e.hash)then raise exception 'STOP: baseline visibility/scoring/access contract mismatch';end if;
end $preflight$;
"""
target.mkdir(parents=True)
(target/'00_preflight_112.sql').write_text(preflight,encoding='utf-8',newline='\n')
r = pending[0]
body,count = re.subn(r'(?im)^begin;\s*','',r['body'],count=1)
assert count==1 and body.rstrip().lower().endswith('commit;')
marker='$adme_policy_source$'
assert marker not in r['body']
apply="begin;\nset local lock_timeout='5s';\nset local statement_timeout='120s';\n"+preflight+body.rstrip()[:-7]
apply+=f"\ninsert into supabase_migrations.schema_migrations(version,name,statements)values('{r['version']}','{r['name']}',array[{marker}{r['body']}{marker}]);\ncommit;\n"
(target/'01_apply_112_to_113.sql').write_text(apply,encoding='utf-8',newline='\n')
(target/'02_verify.sql').write_text("""-- Read-only; no records or credentials.
select count(*)as migrations from supabase_migrations.schema_migrations; --113
select count(*)as legacy_snapshots from adme_recommendation.snapshots where model_version='adme-1.0'; --same as backup
select has_function_privilege('authenticated','public.recommendation_create_v12(uuid,uuid,boolean)','execute')as actor_create,
has_function_privilege('anon','public.recommendation_page_v12(uuid,uuid,boolean)','execute')as anonymous_read,
has_function_privilege('authenticated','adme_recommendation.context_v12(uuid,boolean)','execute')as helper,
has_table_privilege('authenticated','adme_recommendation.snapshots','select')as raw_read; --true,false,false,false
select enabled,policy_ref,retention_days from adme_brief.controls; --no change; separate U001/D079 gates remain
""",encoding='utf-8',newline='\n')
(target/'README_KO.md').write_text("""# D045 추천 저장 정책 ·112→113 검토 패키지

이 패키지는 이전109→112 패키지 이후의 검토된112 기준만 지원합니다.00_preflight_112.sql이 정확한112개 버전·이름과 핵심7개 함수 정의를 검사합니다. 임의의 오래된/부분 적용 DB에 직접 적용하거나 이력·함수 해시를 고쳐 강행하지 마세요. USER/B D085가 대상 이력·백업·복구 지점을 확인한 후 SQL 콘솔에서01_apply_112_to_113.sql을 적용하고02_verify.sql을 확인합니다. 소스/이력 기록은 한 트랜잭션입니다. 같은 소스 앱 배포와 실제 URL 회귀는 USER가 조율합니다. 에이전트는 클라우드 적용·배포·키 등록을 하지 않았습니다.

추천 새 저장·조회 API는 adme-1.2입니다. 분야/예산의 필수·선호 조건, 필수 정보 미확인 후보의 보류·제외, 결측 요인/충족률/점수·입력·출처를 고정합니다. 조건 통과 후보를 먼저, 보류 후보를 뒤에 표시합니다. 보류는 통과가 아닙니다. 계정·캠페인 권한, 동시 재전송, 이력 불변성, 생성/조회 한도와1000명/6결과/20이력 제한을 유지합니다. 운영 앱은 가상 자료를 제외하며 TEST 앱만 명시적인 가상 범위를 선택합니다. 클라이언트는 API에 정책·점수·owner/demo 범위를 주입할 수 없습니다. DB 직접 TEST 범위 요청도 가상 표시를 유지합니다.

이전1.0 결과·입력은 덮어쓰지 않습니다. 기존 RPC는1.0 이력만 반환하고 지원하지 않는 필수 조건의 새1.0 계산은 거부합니다. 새 UI는1.0을 당시 규칙의 과거 기록으로 표시하며 정책/모델 변경에 이전 결과 표시를 합니다. 같은 key의 기존1.0 receipt는 새 API에서도 같은 ID를 반환합니다. 가상 제외 모드 또는 공개/동의 철회 후에는 과거 후보도 숨깁니다. HOT·유료 순위·연락처·오디언스 추정은 점수 입력이 아닙니다.

실제 검증 범위는 격리 로컬 SQL/Auth/PostgREST와 명시적인 가상 데이터입니다.165 입력의 JS/SQL 비교, 신구 호환·권한·한도·정책 변경, 데스크톱/모바일을 검증합니다. 실제 플랫폼·LLM·운영 수용의 통과를 의미하지 않습니다. 수집/결제/법적 정책을 활성화하지 않습니다. U001/D079와 다른 기존 외부 게이트는 그대로입니다. 증거: harness/evidence/D045/POLICY_20261123.md 및 DEV-A-RECOMMENDATION-POLICY-20261123/verification.json.
""",encoding='utf-8',newline='\n')
manifest=dict(source_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),baseline_count=112,target_count=113,baseline_function_hashes=fingerprints,baseline=[{k:r[k]for k in ('version','name','sha256')}for r in baseline],pending=[{k:r[k]for k in ('version','name','sha256')}for r in pending])
manifest['files']={p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in target.iterdir()}
(target/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
archive=target.parent/'AD-Me_DEV-A_RECOMMENDATION_POLICY_20261123_review.zip'
assert not archive.exists()
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED)as z:
    for p in sorted(target.iterdir()):z.write(p,arcname=p.name)
print('Prepared immutable reviewed112→113 packet; no collection/billing/policy flags changed')
