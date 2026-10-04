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
await query('INSERT INTO classes(id,label) VALUES(?,?)',[group,'운영 검증 전용']);
for(const account of accounts){await query('INSERT INTO accounts(id,legacy_identity,display_name,class_id,role) VALUES(?,?,?,?,?)',[account.id,'cutover-verification:'+account.id,account.name,group,account.role]);await query('INSERT INTO credentials(account_id,login_name,pin_hash) VALUES(?,?,?)',[account.id,account.name,await hashPin(pin)]);}
await writeFile('.local/cutover-20261004/smoke-cohort.private.json',JSON.stringify({group,accounts}),{mode:0o600});
let browser;const report={checkedAt:new Date().toISOString(),cohort:'dedicated production verification accounts; no existing student PIN used',existingAccountsReset:false,existingDataDeleted:false};
try{
 const options={...browserOptions(site),env:{...process.env,XDG_CONFIG_HOME:'/tmp/okgu-chromium-config',XDG_CACHE_HOME:'/tmp/okgu-chromium-cache'}};
 browser=await chromium.launch(options);
 const context=await browser.newContext(),page=await context.newPage();let gas=0;const errors=[];
 page.on('request',r=>{if(/script\.(google|googleusercontent)\.com/.test(r.url()))gas++;});page.on('pageerror',e=>errors.push(e.message));
 async function login(page,account){await page.goto(site);await page.locator('#li-name').fill(account.name);await page.locator('#li-pin').fill(pin);await page.locator('#li-remember').check();await page.locator('#login-btn').click();await page.waitForFunction(()=>typeof currentUser!=='undefined'&&!!currentUser);}
 await login(page,accounts[0]);
 await page.evaluate(()=>{document.getElementById('diary-text').value='운영 Cloud 저장 경로 자동 검증 기록 (원본 학생 기록과 분리)';document.getElementById('diary-date').value=todayKey();curMood={emoji:'🙂',label:'좋아',color:'#111'};});
 const wait=page.waitForResponse(r=>r.url()===api+'/api/rpc'&&r.request().postDataJSON()?.method==='saveEntry');await page.locator('#save-btn').click();const response=await wait,saved=await response.json();assert.equal(response.status(),200);assert.equal(saved.entry.id,saved.id);report.entryId=saved.id;
 assert.equal((await query('SELECT id FROM diaries WHERE id=? AND author_id=?',[saved.id,accounts[0].id])).length,1);report.cloudInsert=true;
 await page.waitForFunction(id=>myEntries.some(e=>e.id===id),saved.id);report.immediateStudentList=true;
 const token=await page.evaluate(()=>OKGUAPI.getToken());
 const rpc=async(token,method,args=[])=>{const r=await fetch(api+'/api/rpc',{method:'POST',headers:{Origin:'https://rlasksk030.github.io','Content-Type':'application/json','X-OKGU-Request':'1',Authorization:'Bearer '+token},body:JSON.stringify({method,args})});return {status:r.status,value:await r.json()};};
 assert.equal((await rpc(token,'getEntry',[saved.id])).status,200);
 const teacherContext=await browser.newContext(),teacher=await teacherContext.newPage();await login(teacher,accounts[1]);
 const teacherToken=await teacher.evaluate(()=>OKGUAPI.getToken());assert.equal((await rpc(teacherToken,'getEntry',[saved.id])).status,200);
 await teacher.evaluate(()=>loadFeed(true));await teacher.waitForFunction(id=>feedEntries.some(e=>e.id===id),saved.id);report.teacherList=true;
 const peer=(await rpc('','login',[accounts[2].name,pin,false])).value;assert.equal((await rpc(peer.token,'getEntry',[saved.id])).status,404);report.unauthorizedPeerDenied=true;
 await page.reload();await page.waitForFunction(id=>myEntries.some(e=>e.id===id),saved.id);report.reload=true;
 const jobs=await query("SELECT payload FROM push_jobs WHERE account_id=? AND json_extract(payload,'$.guard.link')=?",[accounts[1].id,saved.id]);assert.equal(jobs.length,1);const payload=JSON.parse(jobs[0].payload);assert.equal(payload.entryId,saved.id);assert.equal(payload.studentId,accounts[0].id);assert.equal(payload.classId,group);report.notificationOutboxLinked=true;report.pushDelivery=false;
 const state=await context.storageState();await browser.close();browser=await chromium.launch(options);
 const reopened=await browser.newContext({storageState:state}),relaunch=await reopened.newPage();await relaunch.goto(site);await relaunch.waitForFunction(id=>myEntries.some(e=>e.id===id),saved.id);report.browserRelaunch=true;
 const fresh=await browser.newContext(),freshPage=await fresh.newPage();await login(freshPage,accounts[0]);await freshPage.waitForFunction(id=>myEntries.some(e=>e.id===id),saved.id);report.freshAuthenticatedSession=true;
 report.gasRequests=gas;assert.equal(gas,0);report.pageErrors=errors;assert.equal(errors.length,0);
 await writeFile('docs/검증/cloud-production-smoke-20261004.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{
 if(browser)await browser.close();
 // Keep all verification rows; deactivate only the three newly created test accounts.
 for(const account of accounts)await query('UPDATE accounts SET active=0 WHERE id=? AND legacy_identity=?',[account.id,'cutover-verification:'+account.id]);
}
