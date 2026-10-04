import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {database} from './helpers/d1.mjs';
import {write} from '../worker/writes.ts';
import {digest} from '../worker/auth.ts';

async function adapter({origin='https://okgu-diary-api.rlasksk030.workers.dev',transport}={}){
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const window={OKGU_CONFIG:{apiOrigin:origin},dispatchEvent(){}};
 vm.runInNewContext(await readFile('rpc.js','utf8'),{window,location:{hostname:'rlasksk030.github.io'},sessionStorage:storage,localStorage:storage,crypto,fetch:transport,AbortController,setTimeout,clearTimeout,Event,console});
 return window.OKGUAPI;
}
test('production rejects GAS and trial config before any request',async()=>{
 for(const origin of ['https://script.google.com/exec','https://okgu-diary-trial.rlasksk030.workers.dev']){
  let requests=0;const api=await adapter({origin,transport:()=>{requests++;}});
  await assert.rejects(api.call('saveEntry',[]));assert.equal(requests,0);
 }
});
test('Cloud failures and malformed successes never fall back; retry keeps the same idempotency key',async()=>{
 const calls=[];let response=0;
 const api=await adapter({transport:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return response++===0?Response.json({success:false,code:'E_SERVER'},{status:500}):response===2?Response.json({success:true}):Response.json({success:true,id:'cloud-id',entry:{id:'cloud-id',version:1}});}});
 await assert.rejects(api.call('saveEntry',[]));await assert.rejects(api.call('saveEntry',[]));
 assert.equal((await api.call('saveEntry',[])).id,'cloud-id');
 assert.equal(new Set(calls.map(c=>c.body.requestId)).size,1);
 assert(calls.every(c=>c.url==='https://okgu-diary-api.rlasksk030.workers.dev/api/rpc'));
});
test('claimed old pages cannot send JSONP, POST or redirect requests to GAS',async()=>{
 const handlers={};let network=0;
 vm.runInNewContext(await readFile('sw.js','utf8'),{self:{location:{href:'https://rlasksk030.github.io/okgu-diary-alarm-/sw.js'},addEventListener:(name,handler)=>handlers[name]=handler},URL,Response,fetch:()=>{network++;}});
 for(const [url,destination] of [['https://script.google.com/exec?fn=saveEntry&callback=__jp1_123','script'],['https://script.google.com/exec',''],['https://script.googleusercontent.com/macros/echo','']]){
  let result;handlers.fetch({request:{url,destination,method:'POST'},respondWith:r=>result=r});const response=await result;
  if(destination==='script')assert.match(await response.text(),/^__jp1_123\(\{"ok":false/);else assert.equal(response.status,409);
 }
 assert.equal(network,0);
});
test('failed D1 INSERT rolls back notifications and receipts; success links only a persisted row',async()=>{
 const db=await database();try{
  db.sqlite.exec("INSERT INTO classes VALUES('c','검증반');INSERT INTO accounts(id,legacy_identity,display_name,class_id,role) VALUES('s','test:s','검증학생','c','student'),('t','test:t','검증교사','c','teacher');");
  db.sqlite.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await digest('token'),'s',Date.now()+60000);
  const a=db.sqlite.prepare("SELECT * FROM accounts WHERE id='s'").get(),env={DB:db.DB,APP_URL:'https://rlasksk030.github.io/okgu-diary-alarm-/'};
  const body={method:'saveEntry',args:['','2026-10-04','🙂','좋아','#111','저장 검증',false,false,false,'[]',''],requestId:crypto.randomUUID()};
  db.sqlite.exec("CREATE TRIGGER injected_failure BEFORE INSERT ON diaries BEGIN SELECT RAISE(ABORT,'TEST_INSERT_FAILURE'); END;");
  await assert.rejects(write(env,a,'token',body),/TEST_INSERT_FAILURE/);
  for(const table of ['diaries','notifications','push_jobs','receipts'])assert.equal(db.sqlite.prepare('SELECT count(*) n FROM '+table).get().n,0);
  db.sqlite.exec('DROP TRIGGER injected_failure');
  const saved=await write(env,a,'token',body),job=db.sqlite.prepare('SELECT * FROM push_jobs').get(),payload=JSON.parse(job.payload);
  assert.equal(db.sqlite.prepare('SELECT id FROM diaries').get().id,saved.id);
  assert.equal(payload.entryId,saved.id);assert.equal(payload.studentId,'s');assert.equal(payload.classId,'c');
  assert.equal(new URL(payload.url).searchParams.get('id'),saved.id);
  assert.equal((await write(env,a,'token',body)).id,saved.id);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM push_jobs').get().n,1);
 }finally{db.close();}
});
