// Only the marked disposable loopback Auth/PostgREST/DB. No hosted keys or users.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { localClient, localRuntime, localJwt, sql } from './support/local-qa.mjs';
import { qaSignupConsent } from './support/consent-fixture.mjs';
const admin=localClient(localRuntime().SERVICE_ROLE_KEY), accounts=[];
const create=db=>db.rpc('create_privacy_export');
const consume=(db,t)=>db.rpc('consume_privacy_export',{p_id:t.id,p_token:t.token});
async function account(role){
  const credentials={email:`d074-db-${randomUUID()}@example.test`,password:randomUUID()+'Aa1!'};
  const result=await admin.auth.admin.createUser({...credentials,email_confirm:true,user_metadata:{...qaSignupConsent,role,name:'D074 DB QA'}});
  assert.equal(result.error,null);const id=result.data.user.id;accounts.push(id);
  const db=localClient();assert.equal((await db.auth.signInWithPassword(credentials)).error,null);
  return {db,id,credentials};
}
try{
  const a=await account('brand'),b=await account('creator');
  assert.ok((await create(localClient())).error,'anonymous create denied');
  assert.ok((await consume(localClient(),{id:randomUUID(),token:'0'.repeat(64)})).error,'anonymous consume denied');
  for(const [owner,foreign] of [[a,b],[b,a]]){
    const made=await create(owner.db);assert.equal(made.error,null);const t=made.data[0];
    assert.match(t.token,/^[a-f0-9]{64}$/);assert.ok(Date.parse(t.expires_at)>Date.now());
    assert.ok(Date.parse(t.expires_at)<Date.now()+901000);
    assert.ok((await owner.db.from('privacy_exports').select('token_hash')).error);
    assert.equal(sql(`select count(*) from privacy_exports where token_hash='${t.token}'`),'0');
    assert.deepEqual((await foreign.db.from('privacy_exports').select('id').eq('id',t.id)).data,[]);
    assert.equal((await consume(foreign.db,t)).data,'denied');
    assert.equal((await consume(owner.db,{...t,token:'0'.repeat(64)})).data,'denied');
    const race=await Promise.all([consume(owner.db,t),consume(owner.db,t)]);
    assert.deepEqual(race.map(r=>r.data).sort(),['ok','reused']);
    const expired=(await create(owner.db)).data[0];
    sql(`update privacy_exports set expires_at=now()-interval'1 second' where id='${expired.id}'`);
    assert.equal((await consume(owner.db,expired)).data,'expired');
    assert.ok((await owner.db.from('privacy_access_log').insert({user_id:owner.id,action:'created'})).error);
    assert.deepEqual((await foreign.db.from('privacy_access_log').select('id').eq('user_id',owner.id)).data,[]);
    const actions=(await owner.db.from('privacy_access_log').select('action')).data.map(r=>r.action);
    for(const action of ['created','downloaded','expired','reused','denied'])assert.ok(actions.includes(action));
  }
  console.log('PASS both roles: own RLS, token hash, foreign/wrong-token denial, one-use race, expiry, audit protection');

  const claims=(await a.db.auth.getClaims()).data.claims, sid=claims.session_id;
  sql(`update auth.mfa_amr_claims set created_at=now()-interval'20 minutes',updated_at=now()-interval'20 minutes' where session_id='${sid}'`);
  assert.equal((await localClient().auth.signInWithPassword(a.credentials)).error,null);
  assert.equal((await a.db.auth.refreshSession()).error,null);
  assert.match((await create(a.db)).error.message,/reauth_required/);
  // Signed fixture claims exercise malformed/boundary paths only, never API success claims.
  const now=Math.floor(Date.now()/1000);
  for(const amr of [null,{},[],[{method:'token_refresh',timestamp:now}],[{method:'password',timestamp:String(now)}],[{method:'password',timestamp:now+600}],[{method:'password',timestamp:now-600}]]){
    const db=localClient(undefined,localJwt(a.id,{session_id:sid,amr}));
    assert.match((await create(db)).error.message,/reauth_required/);
  }
  const missing=localClient(undefined,localJwt(a.id,{session_id:randomUUID()}));
  assert.match((await create(missing)).error.message,/reauth_required/);
  console.log('PASS actual old-session proof denied after different login/refresh; malformed, future, exact 600s, missing-session claims denied');

  const fresh=localClient();assert.equal((await fresh.auth.signInWithPassword(a.credentials)).error,null);
  sql(`delete from privacy_exports where user_id='${a.id}'`);
  const quota=await Promise.all(Array.from({length:8},()=>create(fresh)));
  assert.equal(quota.filter(r=>!r.error).length,5);
  assert.equal(quota.filter(r=>r.error?.message.includes('rate_limited')).length,3);
  assert.equal(sql(`select count(*) from privacy_exports where user_id='${a.id}'`),'5');
  const live=(await fresh.auth.getSession()).data.session.access_token;
  assert.equal((await fresh.auth.signOut({scope:'global'})).error,null);
  assert.match((await create(localClient(undefined,live))).error.message,/reauth_required/);
  console.log('PASS concurrent 24-hour quota exactly 5/8; revoked real-session JWT denied by direct RPC');
}finally{for(const id of accounts)await admin.auth.admin.deleteUser(id);}
