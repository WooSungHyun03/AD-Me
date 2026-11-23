import {createClient} from 'npm:@supabase/supabase-js@2.119.1';
import {allowsTestPayment} from './feature.ts';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return json({error:'POST only'},405);
 if(!allowsTestPayment(Deno.env.get('ADME_SERVICE_MODE'),Deno.env.get('ADME_FEATURE_TEST_BILLING')))return json({error:'현재 환경에서 TEST 결제를 제공하지 않습니다.'},404);
 const url=Deno.env.get('SUPABASE_URL')!;
 const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const auth=req.headers.get('Authorization');if(!auth?.startsWith('Bearer '))return json({error:'로그인이 필요합니다.'},401);
 const {data:{user},error:authError}=await admin.auth.getUser(auth.slice(7));if(authError||!user)return json({error:'로그인이 필요합니다.'},401);
 const {data:billingEnabled,error:billingError}=await admin.rpc('test_billing_available');
 if(billingError||billingEnabled!==true)return json({error:'현재 DB에서 TEST 결제를 제공하지 않습니다.'},404);
 const b=await req.json().catch(()=>null);
 // D068: TEST cancel. Only the stored paymentKey of an order the caller owns is used; the client never sends one.
 if(b?.action==='cancel')return cancel(admin,user.id,b);
 if(!b||typeof b.orderId!=='string'||typeof b.paymentKey!=='string'||!b.paymentKey||b.paymentKey.length>300||!Number.isSafeInteger(b.amount)||b.amount<=0)return json({error:'잘못된 결제 정보입니다.'},400);
 const {data:o}=await admin.from('orders').select('*').eq('id',b.orderId).eq('owner_id',user.id).single();
 if(!o||o.amount!==b.amount)return json({error:'주문 소유권 또는 금액이 일치하지 않습니다.'},403);
 if(o.status==='paid')return o.payment_key===b.paymentKey?json({ok:true,duplicate:true}):json({error:'이미 승인된 다른 결제입니다.'},409);
 if(o.status!=='pending')return json({error:'승인할 수 없는 주문입니다.'},409);
 const secret=Deno.env.get('TOSS_SECRET_KEY');
 if(!secret||!/^test_sk_/.test(secret))return json({error:'Toss TEST 시크릿 키 연결이 필요합니다.'},503);
 try{
  const res=await fetch('https://api.tosspayments.com/v1/payments/confirm',{method:'POST',headers:{Authorization:'Basic '+btoa(secret+':'),'Content-Type':'application/json','Idempotency-Key':o.id},body:JSON.stringify({orderId:o.id,amount:o.amount,paymentKey:b.paymentKey}),signal:AbortSignal.timeout(15000)});
  let payment=await res.json();
  if(!res.ok){
   // Reconcile a previous successful provider confirmation after an interrupted DB write.
   const check=await fetch('https://api.tosspayments.com/v1/payments/'+encodeURIComponent(b.paymentKey),{headers:{Authorization:'Basic '+btoa(secret+':')},signal:AbortSignal.timeout(10000)});
   if(!check.ok)return json({error:'Toss TEST 승인이 완료되지 않았습니다. 이용권은 부여되지 않았습니다.'},400);
   payment=await check.json();
  }
  if(payment.status!=='DONE'||payment.orderId!==o.id||payment.totalAmount!==o.amount||payment.paymentKey!==b.paymentKey)return json({error:'결제 승인 정보가 일치하지 않습니다.'},409);
  const {data,error}=await admin.rpc('finalize_test_order',{p_order:o.id,p_owner:user.id,p_payment_key:b.paymentKey,p_amount:o.amount});
  if(error)return json({error:'결제는 확인되었으나 이용권 저장에 실패했습니다. 같은 주문으로 재확인해주세요.'},503);
  return json({ok:true,entitlementId:data});
 }catch{return json({error:'결제 서버 응답을 확인하지 못했습니다. 같은 주문으로 다시 확인해주세요.'},503);}
});

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// deno-lint-ignore no-explicit-any
async function cancel(admin:any,uid:string,b:any){
 if(typeof b.orderId!=='string'||!UUID.test(b.orderId)||typeof b.idempotencyKey!=='string'||!UUID.test(b.idempotencyKey)||typeof b.reason!=='string'||b.reason.trim().length<2||b.reason.length>200)return json({error:'invalid_request'},400);
 const secret=Deno.env.get('TOSS_SECRET_KEY');
 if(!secret||!/^test_sk_/.test(secret))return json({error:'secret_missing'},503); // checked first: no stray cancel rows
 const {data:rows,error}=await admin.rpc('begin_test_cancel',{p_order:b.orderId,p_owner:uid,p_reason:b.reason,p_key:b.idempotencyKey});
 if(error)return json({error:(error.message.match(/^[a-z_]+$/)?.[0])??'cancel_failed'},409);
 const c=rows[0];
 if(c.status!=='requested')return json({ok:c.status==='done',status:c.status,duplicate:true});
 const auth={Authorization:'Basic '+btoa(secret+':')};
 const finish=(ok:boolean,status:string|null,code:string|null)=>admin.rpc('finish_test_cancel',{p_id:c.cancellation_id,p_ok:ok,p_provider_status:status,p_error:code});
 try{
  // Same Idempotency-Key on retry: Toss replays the first response instead of cancelling twice.
  const res=await fetch('https://api.tosspayments.com/v1/payments/'+encodeURIComponent(c.payment_key)+'/cancel',{method:'POST',headers:{...auth,'Content-Type':'application/json','Idempotency-Key':b.idempotencyKey},body:JSON.stringify({cancelReason:b.reason.trim()}),signal:AbortSignal.timeout(15000)});
  let payment=await res.json();
  if(!res.ok){
   if(payment?.code==='IDEMPOTENT_REQUEST_PROCESSING')return json({error:'provider_retry'},503);
   // e.g. ALREADY_CANCELED_PAYMENT after an interrupted DB write: trust the provider's current state.
   const check=await fetch('https://api.tosspayments.com/v1/payments/'+encodeURIComponent(c.payment_key),{headers:auth,signal:AbortSignal.timeout(10000)});
   const current=check.ok?await check.json():null;
   if(current?.status!=='CANCELED'){
    const code=typeof payment?.code==='string'?payment.code.slice(0,80):'provider_error';
    if(res.status>=500)return json({error:'provider_retry'},503); // stays requested; same key resumes
    await finish(false,current?.status??null,code);
    return json({error:'provider_refused',code},400);
   }
   payment=current;
  }
  if(payment.status!=='CANCELED'||payment.orderId!==b.orderId)return json({error:'provider_mismatch'},409);
  const {error:e2}=await finish(true,'CANCELED',null);
  if(e2)return json({error:'provider_retry'},503);
  return json({ok:true,status:'done'});
 }catch{return json({error:'provider_retry'},503);}
}
