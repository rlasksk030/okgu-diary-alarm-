// Synthetic trial only. Actual paused Worker responses; no mocked maintenance.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {browserOptions} from './lib/browser-options.mjs';
import {requireTrialBranch} from './lib/trial-cloudflare.mjs';
requireTrialBranch();
const api='https://okgu-diary-trial.rlasksk030.workers.dev',front='https://okgu-diary-pages-trial.rlasksk030.workers.dev';
const results=[],contexts=[],pages=[],errors=[];let browser,paused=false,gas=0;
const barrier=mode=>new Promise((resolve,reject)=>{const p=spawn('node',['--use-env-proxy','scripts/trial-write-barrier.mjs',mode],{stdio:'ignore',env:process.env});p.once('error',()=>reject(Error('E_BARRIER')));p.once('exit',code=>code===0?resolve():reject(Error('E_BARRIER')));});
const deploy=mode=>new Promise((resolve,reject)=>{
 const p=spawn('npm',['run','deploy:trial'],{stdio:'ignore',env:{...process.env,OKGU_TRIAL_API_ORIGIN:api,OKGU_TRIAL_FRONTEND_ORIGIN:front,OKGU_TRIAL_PAGES_CORS:'yes',OKGU_TRIAL_WRITE_MODE:mode,OKGU_TRIAL_LOGIN_DIAGNOSTICS:''}});
 p.once('error',()=>reject(Error('E_DEPLOY')));p.once('exit',code=>code===0?resolve():reject(Error('E_DEPLOY')));
});
async function ready(mode){
 const end=Date.now()+45000;
 while(Date.now()<end){
  const h=await fetch(api+'/api/health?check='+Date.now(),{cache:'no-store'}).then(r=>r.json());assert.equal(h.push,'disabled');
  const r=await fetch(api+'/api/rpc',{method:'POST',headers:{Origin:front,'X-OKGU-Request':'1','Content-Type':'application/json'},body:JSON.stringify({method:'login',args:[]})});
  if(h.writes===mode&&r.status===(mode==='paused'?503:401))return;
  await new Promise(r=>setTimeout(r,500));
 }throw Error('E_WRITE_MODE_READINESS');
}
async function rpc(p,method,args=[]){return p.evaluate(({method,args})=>OKGUAPI.call(method,args),{method,args});}
try{
 await ready('active');browser=await chromium.launch(browserOptions(front));
 for(const [name,preuploaded] of [['시험학생07',false],['시험학생08',true]]){
  const c=await browser.newContext({timezoneId:'Asia/Seoul'});contexts.push(c);const p=await c.newPage();
  let maintenanceDialog=false;p.on('dialog',async d=>{if(d.message().includes('자료 점검 중'))maintenanceDialog=true;await d.dismiss();});
  p.on('pageerror',()=>errors.push('browser exception'));p.on('request',r=>{if(/script\.google(?:usercontent)?\.com/.test(r.url()))gas++;});
  await p.goto(front+'/okgu-diary-alarm-/');await p.locator('#li-name').fill(name);await p.locator('#li-pin').fill('0042');await p.locator('#li-remember').check();await p.locator('#login-btn').click();
  await p.locator('#main-app').waitFor({state:'visible',timeout:45000});await p.locator('#custom-confirm-cancel').click();await p.evaluate(()=>navButtonFor('write').click());
  const text='가상 동결 재시도 '+crypto.randomUUID();await p.locator('#diary-text').fill(text);await p.locator('#share-meonly-lbl').click();
  await p.locator('input[type=file]').setInputFiles('fixtures/photo.png');await p.waitForFunction(()=>pendingPhotos.length===1&&!!pendingPhotos[0].base64);
  if(preuploaded)await p.evaluate(async()=>{const photo=pendingPhotos[0],b=photo.base64;photo.uploadId=crypto.randomUUID();const data=Uint8Array.from(atob(b.slice(b.indexOf(',')+1)),c=>c.charCodeAt(0));photo.uploadedRef=(await OKGUAPI.upload(data,photo.uploadId)).url;});
  const count=(await rpc(p,'getMyStats',['all'])).total;
  const before=await p.evaluate(()=>({body:document.getElementById('diary-text').value,date:document.getElementById('diary-date').value,scope:document.querySelector('input[name=share-mode]:checked').value,photo:pendingPhotos[0].base64,ref:pendingPhotos[0].uploadedRef||null,token:OKGUAPI.getToken()}));
  pages.push({p,preuploaded,text,count,before,dialog:()=>maintenanceDialog});
 }
 paused=true;console.log('Pausing synthetic trial for two browser save cases');await barrier('paused');await deploy('paused');await ready('paused');
 for(const item of pages){
  const {p,preuploaded,before}=item;
  // Deployment propagation differs between Node and the browser's connection.
  // Probe BOTH exact POST paths from this browser before saving any draft.
  await p.waitForFunction(async()=>{
   const headers={Authorization:'Bearer '+OKGUAPI.getToken(),'X-OKGU-Request':'1','Content-Type':'application/json'};
   const save=await fetch(OKGU_CONFIG.apiOrigin+'/api/rpc',{method:'POST',cache:'no-store',headers,body:JSON.stringify({method:'saveEntry',args:[]})});
   const photo=await fetch(OKGU_CONFIG.apiOrigin+'/api/photos',{method:'POST',cache:'no-store',headers:{Authorization:headers.Authorization,'X-Request-Id':crypto.randomUUID()},body:new Uint8Array()});
   return save.status===503&&photo.status===503;
  },undefined,{timeout:60000,polling:1000});
  // Attach the response waiter before clicking and handle its rejection immediately.
  const trace=[];p.on('response',r=>{if(r.url().startsWith(api+'/api/'))trace.push({path:new URL(r.url()).pathname,status:r.status(),method:r.request().method()});});
  const response=p.waitForResponse(r=>r.url().startsWith(api+'/api/'+(preuploaded?'rpc':'photos'))&&r.request().method()==='POST'&&r.status()===503,{timeout:45000});
  let r;try{[r]=await Promise.all([response,p.locator('#save-btn').click()]);}catch(e){console.log(JSON.stringify({preuploaded,trace,state:await p.evaluate(()=>({busy:_saveInProgress,bodyLength:document.getElementById('diary-text').value.length,photoCount:pendingPhotos.length,refPresent:!!pendingPhotos[0]?.uploadedRef,moodPresent:!!curMood,progress:document.getElementById('photo-upload-progress').style.display})),maintenanceDialog:item.dialog()}));throw e;}assert.equal((await r.json()).code,'E_MAINTENANCE');
  await p.waitForFunction(()=>!_saveInProgress);assert(item.dialog());
  assert(JSON.stringify(await p.evaluate(()=>({body:document.getElementById('diary-text').value,date:document.getElementById('diary-date').value,scope:document.querySelector('input[name=share-mode]:checked').value,photo:pendingPhotos[0].base64,ref:pendingPhotos[0].uploadedRef||null,token:OKGUAPI.getToken()})))===JSON.stringify(before),'E_DRAFT_ATTACHMENT_OR_SESSION_CHANGED');
  assert.equal(await p.locator('#save-msg').isVisible(),false);assert.equal((await rpc(p,'getMyStats',['all'])).total,item.count);
  assert.equal(await p.locator('#save-btn').isEnabled(),true);
  results.push({name:preuploaded?'uploaded photo reference, body, date, private scope and remembered session survive actual diary 503':'unuploaded attachment, body, date, private scope and remembered session survive actual photo 503',success:true});
 }
 console.log('Resuming synthetic trial');await deploy('active');await barrier('active');await ready('active');paused=false;
 for(const item of pages){
  const {p,text,count}=item;let saves=0;p.on('request',r=>{if(r.url()===api+'/api/rpc'&&r.postDataJSON()?.method==='saveEntry')saves++;});
  await p.locator('#save-btn').click();await p.evaluate(()=>saveToday());
  await p.waitForFunction(text=>!_saveInProgress&&myEntries.some(e=>e.text===text),text,{timeout:45000});
  assert.equal(saves,1);assert.equal((await rpc(p,'getMyStats',['all'])).total,count+1);
  const entry=await p.evaluate(text=>myEntries.find(e=>e.text===text),text);assert.equal(entry.photos.length,1);assert.equal(entry.isMeOnly,true);
  const photo=await p.evaluate(ref=>OKGUAPI.request('/api/photos/'+ref.slice(11),{headers:{Authorization:'Bearer '+OKGUAPI.getToken()}}).then(r=>({status:r.status,bytes:r.headers.get('Content-Length')})),entry.photos[0]);assert.equal(photo.status,200);
  assert.equal(await p.locator('#diary-text').inputValue(),'');assert.equal(await p.evaluate(()=>pendingPhotos.length),0);
  results.push({name:(item.preuploaded?'already uploaded':'previously rejected upload')+' retry commits exactly one private diary with accessible photo; clears editor only after success; duplicate click suppressed',success:true});
 }
 assert.equal(gas,0);assert.deepEqual(errors,[]);
}finally{
 if(paused){await deploy('active');await barrier('active');await ready('active');}
 for(const c of contexts)await c.close();if(browser)await browser.close();
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/freeze-browser-rehearsal.json',JSON.stringify({at:new Date().toISOString(),environment:'actual Cloudflare synthetic trial frontend and paused API',results,gasRequests:gas,errors,productionFreezeExecuted:false,physicalPhone:false,limitations:['Open-tab draft and attachment retention only; closing/reloading the unsaved editor is not durable backup','Legacy Apps Script freeze has not been installed or tested against production']},null,2)+'\n');
}console.log(JSON.stringify(results));
