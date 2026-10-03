import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './helpers/d1.mjs';
import {nightly,dispatch} from '../worker/push.ts';
import {write} from '../worker/writes.ts';
import {digest} from '../worker/auth.ts';
const at=new Date('2026-10-03T13:00:00Z');
async function setup(){
 const db=await database();db.sqlite.exec("INSERT INTO classes VALUES('c','가상반')");
 for(const [id,role] of [['s','student'],['other','student'],['t','teacher'],['t2','teacher']]){
  db.sqlite.prepare("INSERT INTO accounts(id,legacy_identity,display_name,class_id,role) VALUES(?,?,?,'c',?)").run(id,'fake:'+id,'가상'+id,role);
  db.sqlite.prepare('INSERT INTO push_subscriptions(endpoint_hash,account_id,subscription,updated_at) VALUES(?,?,?,0)').run(id,id,JSON.stringify({endpoint:'https://fcm.googleapis.com/fake/'+id,keys:{p256dh:'fake',auth:'fake'}}));
  db.sqlite.prepare('INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)').run(await digest('fake-token-'+id),id,Date.now()+60000);
 }
 const env={DB:db.DB,PUSH_MODE:'live',ALLOW_LIVE_PUSH:'approved',PUSH_SERVER_SECRET:'fake',PUSH_SERVER_URL:'https://transport.invalid',APP_URL:'https://trial.invalid/okgu-diary-alarm-/'};
 return {db,env};
}
test('pre-dispatch refusals retry only when due, at most three times; no teacher nightly jobs',async()=>{
 const {db,env}=await setup();try{
  assert.equal(await nightly(env,at),2);let calls=0;
  const refuse=async()=>{calls++;return Response.json({ok:false,error:'push server env not configured'},{status:500});};
  await dispatch(env,refuse,at,1);await dispatch(env,refuse,at,1);
  assert.equal(calls,2);await dispatch(env,refuse,new Date(+at+59000));assert.equal(calls,2);
  await dispatch(env,refuse,new Date(+at+60000));assert.equal(calls,4);
  await dispatch(env,refuse,new Date(+at+360000));assert.equal(calls,6);
  await dispatch(env,refuse,new Date(+at+720000));assert.equal(calls,6);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM push_jobs WHERE status='failed' AND attempts=3 AND failure_code='PRE_DISPATCH_REJECTED'").get().n,2);
 }finally{db.close();}
});
test('partial acceptance and all-provider failure stay ambiguous, expired endpoints alone are cleaned',async()=>{
 const {db,env}=await setup();try{
  db.sqlite.prepare('INSERT INTO push_subscriptions(endpoint_hash,account_id,subscription,updated_at) VALUES(?,?,?,0)').run('second','s',JSON.stringify({endpoint:'https://fcm.googleapis.com/fake/second'}));
  await nightly(env,at);
  const transport=async(_url,o)=>{const s=JSON.parse(o.body).subscriptions;return Response.json({ok:true,sent:s.length===2?1:0,failed:1,expired:s.length===2?[s[1].endpoint,'https://fcm.googleapis.com/fake/t']:[]});};
  await dispatch(env,transport,at);
  const partial=db.sqlite.prepare("SELECT * FROM push_jobs WHERE account_id='s'").get();assert.equal(partial.status,'partial');assert.equal(partial.accepted_count,1);assert.equal(partial.failed_count,1);
  assert.equal(db.sqlite.prepare("SELECT status FROM push_jobs WHERE account_id='other'").get().status,'unknown');
  assert.equal(db.sqlite.prepare("SELECT enabled FROM push_subscriptions WHERE endpoint_hash='t'").get().enabled,1);
  await dispatch(env,()=>{throw Error('must never resend');},new Date(+at+60000));
  assert.equal(db.sqlite.prepare('SELECT max(attempts) n FROM push_jobs').get().n,1);
 }finally{db.close();}
});
test('a competing dispatcher cannot cancel a newly deferred retry',async()=>{
 const {db,env}=await setup();try{
  await nightly(env,at);let deferred;
  env.DB={...db.DB,prepare(sql){const statement=db.DB.prepare(sql);
   if(sql.startsWith("UPDATE push_jobs SET status='dispatching'")){
    const run=statement.run.bind(statement);statement.run=async()=>{
     if(!deferred){deferred=statement.params[1];db.sqlite.prepare("UPDATE push_jobs SET status='pending',attempts=1,next_attempt_at=? WHERE id=?").run(+at+60000,deferred);}
     return run();
    };
   }return statement;
  }};
  await dispatch(env,()=>{throw Error('must not send before retry is due');},at,1);
  const job=db.sqlite.prepare('SELECT status,next_attempt_at FROM push_jobs WHERE id=?').get(deferred);
  assert.equal(job.status,'pending');assert.equal(job.next_attempt_at,+at+60000);
  env.DB=db.DB;let calls=0;
  await dispatch(env,async()=>{calls++;return Response.json({ok:true,sent:1,failed:0,expired:[]});},new Date(+at+60000));
  assert.equal(calls,2);assert.equal(db.sqlite.prepare('SELECT status FROM push_jobs WHERE id=?').get(deferred).status,'sent');
 }finally{db.close();}
});
test('freeze prevents dispatch; interrupted claims become unknown without a second send',async()=>{
 const {db,env}=await setup();try{
  await nightly(env,at);db.sqlite.exec('UPDATE operation_control SET writes_paused=1 WHERE id=1');
  assert.equal((await dispatch(env,()=>{throw Error('must not send');},at)).blocked,true);
  db.sqlite.exec('UPDATE operation_control SET writes_paused=0 WHERE id=1');
  db.sqlite.prepare("UPDATE push_jobs SET status='dispatching',attempts=1,updated_at=?").run(+at-16*60000);
  await dispatch(env,()=>{throw Error('must not resend');},at);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM push_jobs WHERE status='unknown' AND failure_code='INTERRUPTED'").get().n,2);
 }finally{db.close();}
});
test('saved diary survives transport failure; replay, comment recipients and original teacher activity remain correct',async()=>{
 const {db,env}=await setup();try{
  const acct=id=>db.sqlite.prepare('SELECT * FROM accounts WHERE id=?').get(id);
  const rpc=(id,method,args,requestId=crypto.randomUUID(),extra={})=>write(env,acct(id),'fake-token-'+id,{method,args,requestId,...extra});
  const requestId=crypto.randomUUID(),args=['ignored','2026-10-03','🙂','좋아','#111','가상 본문',false,true,false,'[]',''];
  const saved=await rpc('s','saveEntry',args,requestId);assert.deepEqual(await rpc('s','saveEntry',args,requestId),saved);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM diaries').get().n,1);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM push_jobs').get().n,2);
  await dispatch(env,async()=>{throw Error('timeout');},new Date());
  assert.equal(db.sqlite.prepare('SELECT body FROM diaries').get().body,'가상 본문');
  db.sqlite.exec('DELETE FROM push_jobs');
  await rpc('t','addTeacherComment',['ignored',saved.id,'가상 댓글']);
  assert.deepEqual(db.sqlite.prepare('SELECT account_id FROM push_jobs').all().map(r=>r.account_id),['s']);
  db.sqlite.exec('DELETE FROM push_jobs');
  await rpc('other','addComment',[saved.id,'ignored','가상 게시판 댓글']);
  assert.deepEqual(db.sqlite.prepare('SELECT account_id FROM push_jobs ORDER BY account_id').all().map(r=>r.account_id),['s','t','t2']);
  db.sqlite.exec('DELETE FROM push_jobs');
  await rpc('other','toggleLike',[saved.id,'ignored']);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM push_jobs').get().n,2);
  assert.match(JSON.parse(db.sqlite.prepare('SELECT payload FROM push_jobs LIMIT 1').get().payload).body,/좋아요를 눌렀어요/);
  db.sqlite.exec('DELETE FROM push_jobs');
  await rpc('s','deleteEntry',['ignored',saved.id],crypto.randomUUID(),{expectedVersion:1});
  let accepted=0;await dispatch(env,async()=>{accepted++;return Response.json({ok:true,sent:1,failed:0,expired:[]});},new Date());assert.equal(accepted,2);
  assert.equal(new URL(JSON.parse(db.sqlite.prepare('SELECT payload FROM push_jobs LIMIT 1').get().payload).url).searchParams.get('open'),'dash');
 }finally{db.close();}
});
