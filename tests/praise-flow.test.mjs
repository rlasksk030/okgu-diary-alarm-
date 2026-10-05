import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {dispatch} from '../worker/push.ts';
import {fixture} from './helpers/praise.mjs';
const site='https://rlasksk030.github.io/okgu-diary-alarm-/',api='https://okgu-diary-api.rlasksk030.workers.dev';

async function adapter(transport){
 const data=new Map([['okgu_fast_token','test-s']]),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const window={OKGU_CONFIG:{apiOrigin:api},dispatchEvent(){}};
 vm.runInNewContext(await readFile('rpc.js','utf8'),{window,location:{hostname:'rlasksk030.github.io'},sessionStorage:storage,localStorage:storage,crypto,fetch:transport,AbortController,setTimeout,clearTimeout,Event,console});
 return window.OKGUAPI;
}
test('short and long Unicode praise: Cloud POST → atomic store → teacher approval → exact recipient body',async()=>{
 const f=await fixture();try{
  const long='  '+('고마워요 😊\n함께해서 즐거웠어요! 👨‍👩‍👧‍👦\n').repeat(200)+' 끝\n ';
  for(const body of ['고마워!',long,'😀'.repeat(10000)]){
   const args=['위조한 발신자','검증친구',body,false],requestId=crypto.randomUUID();
   const saved=await f.rpc('s','sendPraise',args,{requestId});assert.equal(saved.status,200);assert(saved.value.id);
   const id=saved.value.id,row=f.sqlite.prepare('SELECT * FROM praises WHERE id=?').get(id);assert.equal(row.sender_id,'s');assert.equal(row.body,body);
   assert.equal((await f.rpc('s','getPraise')).value.sent.find(p=>p.id===id).msg,body);
   assert.equal((await f.rpc('p','getPraise')).value.received.some(p=>p.id===id),false);
   assert.equal((await f.rpc('s','setPraiseStatus',['',id,'approved'])).status,403);
   assert.equal((await f.rpc('f','setPraiseStatus',['',id,'approved'])).status,404);
   assert.equal((await f.rpc('t','setPraiseStatus',['',id,'approved'])).status,200);
   assert.equal((await f.rpc('p','getPraise')).value.received.find(p=>p.id===id).msg,body);
   assert.equal((await f.rpc('s','sendPraise',args,{requestId})).value.id,id);
   assert.equal(f.sqlite.prepare('SELECT count(*) n FROM praises WHERE id=?').get(id).n,1);
   const job=f.sqlite.prepare("SELECT payload FROM push_jobs WHERE account_id='p' AND json_extract(payload,'$.guard.link')=?").get(id);const payload=JSON.parse(job.payload);assert(new URL(payload.url).searchParams.get('id')===id);assert(payload.body.length<100);assert(!payload.body.includes(body));
  }
  assert.equal((await f.rpc('invalid','sendPraise',['','검증친구','고마워',false])).status,401);
  assert.equal((await f.rpc('s','listAllPraiseForTeacher')).status,403);
  assert.equal((await f.rpc('s','sendPraise',['','다른반교사','고마워',false])).status,400);
  assert.equal((await f.rpc('t','sendPraise',['','검증친구','교사 칭찬',false])).status,200);
  assert.equal((await f.rpc('s','sendPraise',['','담임','선생님 감사합니다',false])).status,200);
  assert.equal((await f.rpc('s','sendPraise',['','검증친구','😀'.repeat(10001),false])).value.code,'E_PRAISE_LENGTH');
  assert.equal((await f.rpc('s','sendPraise',['','검증친구','가'.repeat(23000),false])).value.code,'E_REQUEST_SIZE');
 }finally{await f.finish();}
});
test('D1 failure rolls back; lost/malformed responses and duplicate clicks reuse the same receipt',async()=>{
 const f=await fixture();try{
  let fail=true,malformed=true;const calls=[];
  const client=await adapter(async(url,options)=>{assert.equal(url,api+'/api/rpc');assert.equal(options.method,'POST');assert.equal(options.headers['Content-Type'],'application/json');const request=JSON.parse(options.body);calls.push(request);const response=await f.rpc('s',request.method,request.args,{requestId:request.requestId});if(fail){fail=false;throw Error('TEST_RESPONSE_LOST');}if(malformed){malformed=false;return Response.json({success:true});}return Response.json(response.value,{status:response.status});});
  const args=['검증학생','검증친구','재시도 내용\n😊',false];
  await assert.rejects(client.call('sendPraise',args));await assert.rejects(client.call('sendPraise',args));
  const results=await Promise.all([client.call('sendPraise',args),client.call('sendPraise',args)]);assert.equal(results[0].id,results[1].id);assert.equal(new Set(calls.map(r=>r.requestId)).size,1);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM praises').get().n,1);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM push_jobs').get().n,1);
  f.sqlite.exec("CREATE TRIGGER fail_praise BEFORE INSERT ON praises BEGIN SELECT RAISE(ABORT,'TEST_INSERT_FAILURE'); END;");
  assert.equal((await f.rpc('s','sendPraise',['','검증친구','실패 내용',false])).status,500);
  for(const table of ['praises','receipts','push_jobs','notifications'])assert.equal(f.sqlite.prepare('SELECT count(*) n FROM '+table).get().n,1);
 }finally{await f.finish();}
});
test('failed push transport stays separate from successful save and retry',async()=>{
 const f=await fixture();try{
  const requestId=crypto.randomUUID(),args=['','검증친구','푸시 실패에도 저장',false],saved=await f.rpc('s','sendPraise',args,{requestId});assert.equal(saved.status,200);
  f.sqlite.prepare('INSERT INTO push_subscriptions(endpoint_hash,account_id,subscription,updated_at) VALUES(?,?,?,?)').run('synthetic','t',JSON.stringify({endpoint:'https://invalid.test/never-network',keys:{p256dh:'test',auth:'test'}}),Date.now());
  let calls=0;await dispatch({...f.env,PUSH_MODE:'live',ALLOW_LIVE_PUSH:'approved',PUSH_SERVER_URL:'https://invalid.test/never-network',PUSH_SERVER_SECRET:'synthetic'},async()=>{calls++;throw Error('TEST_PUSH_TIMEOUT');});
  assert.equal(calls,1);assert.equal(f.sqlite.prepare('SELECT status FROM push_jobs').get().status,'unknown');
  assert.equal((await f.rpc('s','sendPraise',args,{requestId})).value.id,saved.value.id);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM praises').get().n,1);
 }finally{await f.finish();}
});
