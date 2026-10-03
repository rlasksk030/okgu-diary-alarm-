import test from 'node:test';import assert from 'node:assert/strict';
import worker from '../worker/index.ts';
test('write freeze blocks login, every mutation and photo upload before DB/R2 access; health and preflight remain available',async()=>{
 let touched=0;const env={WEB_ORIGINS:'https://trial.example',WRITE_MODE:'paused',PUSH_MODE:'disabled',DB:{prepare(){touched++;throw Error('unexpected DB access');}},PHOTOS:{put(){touched++;throw Error('unexpected R2 access');}}},ctx={waitUntil(){throw Error('unexpected background task');}};
 for(const method of ['login','saveEntry','deleteEntry','resetStudentPin','changePin','savePushSubscription','sendPraise','toggleLike','addTeacherComment']){
  const r=await worker.fetch(new Request('https://api.example/api/rpc',{method:'POST',headers:{Origin:'https://trial.example','Content-Type':'application/json','X-OKGU-Request':'1'},body:JSON.stringify({method,args:[]})}),env,ctx);
  assert.equal(r.status,503);assert.equal((await r.json()).code,'E_MAINTENANCE');assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://trial.example');
 }
 assert.equal((await worker.fetch(new Request('https://api.example/api/photos',{method:'POST',headers:{Origin:'https://trial.example'},body:'image'}),env,ctx)).status,503);
 assert.equal((await worker.fetch(new Request('https://api.example/api/health'),env,ctx)).status,200);
 assert.equal((await worker.fetch(new Request('https://api.example/api/rpc',{method:'OPTIONS',headers:{Origin:'https://trial.example'}}),env,ctx)).status,204);assert.equal(touched,0);
});
test('shared D1 freeze stops scheduled cleanup and notifications even before environment propagation',async()=>{
 let checks=0,promise;const env={WRITE_MODE:'active',DB:{prepare(sql){assert.equal(sql,'SELECT writes_paused FROM operation_control WHERE id=1');checks++;return {first:async()=>({writes_paused:1})};}},PHOTOS:{delete(){throw Error('frozen R2 must not be deleted');}}};
 for(const cron of ['0 4 * * *','0 13 * * *']){await worker.scheduled({cron,scheduledTime:Date.now()},env,{waitUntil(p){promise=p;}});await promise;}
 assert.equal(checks,2);
});
test('health reads the shared D1 barrier and fails closed if administrative state is missing',async()=>{
 const env={WEB_ORIGINS:'https://trial.example',WRITE_MODE:'active',PUSH_MODE:'disabled',DB:{prepare(){return {first:async()=>({writes_paused:1})};}}};
 const frozen=await worker.fetch(new Request('https://api.example/api/health'),env,{});assert.equal((await frozen.json()).writes,'paused');
 env.DB.prepare=()=>({first:async()=>null});const missing=await worker.fetch(new Request('https://api.example/api/health'),env,{});assert.equal(missing.status,503);assert.equal((await missing.json()).code,'E_SERVER');
});
