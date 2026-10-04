// Separate production verification cohort. Existing student credentials are never reset.
import {readFile,writeFile} from 'node:fs/promises';
import {randomInt,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {hashPin} from '../worker/auth.ts';
import {cloudflareClient} from './lib/trial-cloudflare.mjs';
import {browserOptions} from './lib/browser-options.mjs';
const site='https://rlasksk030.github.io/okgu-diary-alarm-/',api='https://okgu-diary-api.rlasksk030.workers.dev';
const client=cloudflareClient(),resources=JSON.parse(await readFile('.local/production-resources.private.json'));
assert.equal((await client.accountCall('GET','/d1/database/'+resources.databaseId)).name,'okgu-diary-production');
const query=async(sql,params=[])=>{const r=await client.accountCall('POST','/d1/database/'+resources.databaseId+'/query',{sql,params});assert(r.every(x=>x.success));return r[0].results;};
const group=randomUUID(),pin=String(randomInt(1000,10000)),stamp=Date.now();
const accounts=['student','teacher','student'].map((role,i)=>({id:randomUUID(),name:'운영검증_'+stamp+'_'+i,role}));
await query('INSERT INTO classes(id,label) VALUES(?,?)',[group,'운영검증_'+stamp]);
for(const account of accounts){await query('INSERT INTO accounts(id,legacy_identity,display_name,class_id,role) VALUES(?,?,?,?,?)',[account.id,'cutover-verification:'+account.id,account.name,group,account.role]);await query('INSERT INTO credentials(account_id,login_name,pin_hash) VALUES(?,?,?)',[account.id,account.name,await hashPin(pin)]);}
await writeFile('.local/cutover-20261004/smoke-cohort.private.json',JSON.stringify({group,accounts}),{mode:0o600});
let browser;const report={checkedAt:new Date().toISOString(),cohort:'dedicated production verification accounts; no existing student PIN used',existingAccountsReset:false,existingDataDeleted:false};
try{
 const options={...browserOptions(site),env:{...process.env,XDG_CONFIG_HOME:'/tmp/okgu-chromium-config',XDG_CACHE_HOME:'/tmp/okgu-chromium-cache'}};
 browser=await chromium.launch(options);
 const context=await browser.newContext(),page=await context.newPage();let gas=0;const errors=[];
 page.on('request',r=>{if(/script\.(google|googleusercontent)\.com/.test(r.url()))gas++;});page.on('pageerror',e=>errors.push(e.message));
 async function login(page,account){page.on('dialog',d=>d.dismiss());await page.goto(site);await page.locator('#li-name').fill(account.name);await page.locator('#li-pin').fill(pin);await page.locator('#li-remember').check();await page.locator('#login-btn').click();await page.waitForFunction(()=>typeof currentUser!=='undefined'&&!!currentUser,null,{timeout:60000});await page.evaluate(()=>{const b=document.getElementById('custom-confirm-cancel');if(b)b.click();});}
 const teacherContext=await browser.newContext({permissions:['notifications']}),teacher=await teacherContext.newPage();await login(teacher,accounts[1]);
 // No fake endpoint or injected PushEvent may count as an actual Web Push delivery.
 report.pushSubscription=await teacher.evaluate(async()=>{
  const reg=await navigator.serviceWorker.ready;
  try{const sub=await Promise.race([reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:OKGU_CONFIG.vapidPublicKey}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('subscription timeout')),25000))]);
   const result=await OKGUAPI.call('savePushSubscription',[_getToken(),currentUser.name,currentUser.role,JSON.stringify(sub)]);
   return {registered:result.success===true,permission:Notification.permission};
  }catch(e){return {registered:false,permission:Notification.permission,error:e.name+': '+e.message};}
 });
 console.log(JSON.stringify({stage:'teacher-authenticated',pushSubscription:report.pushSubscription}));
 await login(page,accounts[0]);
 await page.evaluate(()=>{document.getElementById('diary-text').value='운영 Cloud 저장 경로 자동 검증 기록 (원본 학생 기록과 분리)';document.getElementById('diary-date').value=todayKey();curMood={emoji:'🙂',label:'좋아',color:'#111'};});
 await page.evaluate(()=>{document.getElementById('chk-teacher').checked=true;updateShareUI();});
 const wait=page.waitForResponse(r=>r.url()===api+'/api/rpc'&&r.request().postDataJSON()?.method==='saveEntry');await page.locator('#save-btn').click();const response=await wait,saved=await response.json();assert.equal(response.status(),200);assert.equal(saved.success,true);assert(saved.id);assert.equal(saved.entry.id,saved.id);report.entryId=saved.id;report.saveHttpStatus=response.status();report.cloudRpcPost=response.request().method()==='POST';
 assert.equal((await query('SELECT id FROM diaries WHERE id=? AND author_id=?',[saved.id,accounts[0].id])).length,1);report.cloudInsert=true;
 await page.waitForFunction(id=>myEntries.some(e=>e.id===id),saved.id);report.immediateStudentList=true;
 const token=await page.evaluate(()=>OKGUAPI.getToken());
 const rpc=async(token,method,args=[])=>{const r=await fetch(api+'/api/rpc',{method:'POST',headers:{Origin:'https://rlasksk030.github.io','Content-Type':'application/json','X-OKGU-Request':'1',Authorization:'Bearer '+token},body:JSON.stringify({method,args})});return {status:r.status,value:await r.json()};};
 assert.equal((await rpc(token,'getEntry',[saved.id])).status,200);
 const teacherToken=await teacher.evaluate(()=>OKGUAPI.getToken());assert.equal((await rpc(teacherToken,'getEntry',[saved.id])).status,200);
 report.teacherGetEntry=true;assert.equal((await rpc(teacherToken,'getTeacherDashboardBundle',[])).status,200);report.teacherDashboard=true;
 await teacher.evaluate(()=>loadFeed(true));await teacher.waitForFunction(id=>feedEntries.some(e=>e.id===id),saved.id);report.teacherList=true;
 const peer=(await rpc('','login',[accounts[2].name,pin,false])).value;assert.equal((await rpc(peer.token,'getEntry',[saved.id])).status,404);report.unauthorizedPeerDenied=true;
 await page.reload();await page.waitForFunction(id=>myEntries.some(e=>e.id===id),saved.id);report.reload=true;
 const jobs=await query("SELECT payload,status,accepted_count,failed_count FROM push_jobs WHERE account_id=? AND json_extract(payload,'$.guard.link')=?",[accounts[1].id,saved.id]);assert.equal(jobs.length,1);const payload=JSON.parse(jobs[0].payload);assert.equal(payload.entryId,saved.id);assert.equal(payload.studentId,accounts[0].id);assert.equal(payload.classId,group);report.notificationOutboxLinked=true;
 assert.equal((await query('SELECT id FROM notifications WHERE recipient_id=? AND link_id=? AND actor_id=?',[accounts[1].id,saved.id,accounts[0].id])).length,1);report.notificationRow=true;
 report.pushDelivery=false;report.actualNotificationClick=false;
 if(report.pushSubscription.registered){
  try{await teacher.waitForFunction(async id=>(await (await navigator.serviceWorker.ready).getNotifications()).some(n=>n.data?.entryId===id),saved.id,{timeout:45000});report.pushDelivery=true;}catch{report.pushReceiptError='No received notification observed within 45 seconds';}
 }
 // The deep link can be verified independently, without claiming a physical notification click.
 await teacher.goto(payload.url);await teacher.waitForFunction(id=>feedEntries.some(e=>e.id===id),saved.id);report.pushTargetRoute=true;
 report.serviceWorker=await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return {state:r.active.state,scope:r.scope,controlled:!!navigator.serviceWorker.controller};});
 assert.equal(report.serviceWorker.state,'activated');assert(report.serviceWorker.controlled);
 report.appCachedAssets=await page.evaluate(async()=>{let n=0;for(const k of await caches.keys())for(const r of await (await caches.open(k)).keys())if(r.url.startsWith(location.origin+location.pathname))n++;return n;});assert.equal(report.appCachedAssets,0);
 const state=await context.storageState();await browser.close();browser=await chromium.launch(options);
 const reopened=await browser.newContext({storageState:state}),relaunch=await reopened.newPage();await relaunch.goto(site);await relaunch.waitForFunction(id=>myEntries.some(e=>e.id===id),saved.id);report.browserRelaunch=true;
 const fresh=await browser.newContext(),freshPage=await fresh.newPage();await login(freshPage,accounts[0]);await freshPage.waitForFunction(id=>myEntries.some(e=>e.id===id),saved.id);report.freshAuthenticatedSession=true;
 report.gasRequests=gas;assert.equal(gas,0);report.pageErrors=errors;assert.equal(errors.length,0);
 report.cloudE2E=true;
}catch(error){report.cloudE2E=false;report.failure=error.name;throw error;
}finally{
 if(browser)await browser.close();
 // Keep all verification rows; deactivate only the three newly created test accounts.
 for(const account of accounts)await query('UPDATE accounts SET active=0 WHERE id=? AND legacy_identity=?',[account.id,'cutover-verification:'+account.id]);
 report.verificationAccountsDeactivated=true;
 await writeFile('docs/검증/cloud-production-smoke-20261004.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
