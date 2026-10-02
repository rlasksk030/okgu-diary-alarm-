import {chromium} from 'playwright';import {browserOptions} from './lib/browser-options.mjs';
import assert from 'node:assert/strict';import {randomUUID,randomInt,createHash} from 'node:crypto';import {readFile,mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.OKGU_TRIAL_API_ORIGIN||'http://127.0.0.1:3020',base=origin+'/okgu-diary-alarm-/';
if(!['http://127.0.0.1:3020','https://okgu-diary-trial.rlasksk030.workers.dev'].includes(origin))throw new Error('E_TRIAL_ORIGIN');
const health=await fetch(origin+'/api/health').then(r=>r.json());assert.equal(health.push,'disabled');
const results=[],errors=[],contexts=[],newPin=String(randomInt(100,1000)).padStart(4,'0');
let teacherToken='',targetId='',mutated=false,restored=false;const kept=[];
async function call(token,method,args=[],extra={}){const r=await fetch(origin+'/api/rpc',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-OKGU-Request':'1',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({method,args,requestId:randomUUID(),...extra})});let value;try{value=await r.json();}catch{throw new Error('E_TRIAL_RESPONSE_HTTP_'+r.status);}return {status:r.status,value};}
async function login(name,remember=false,pin='0042'){const r=await call('','login',[name,pin,remember]);assert.equal(r.status,200,'synthetic login HTTP');return r.value;}
async function measure(name,task){const start=performance.now();await task();results.push({name,success:true,ms:Math.round(performance.now()-start)});console.log('PASS',name,results.at(-1).ms+'ms');}
const browser=await chromium.launch(browserOptions(origin));
async function page(viewport={width:1365,height:900}){const context=await browser.newContext({viewport,timezoneId:'Asia/Seoul'});contexts.push(context);const p=await context.newPage();p.on('pageerror',()=>errors.push('browser_javascript_exception'));p.on('dialog',d=>d.dismiss());return p;}
async function uiLogin(p,name,pin){await p.goto(base);await p.locator('#li-name').fill(name);await p.locator('#li-pin').fill(pin);await p.locator('#login-btn').click();await p.locator('#main-app').waitFor({state:'visible',timeout:30000});await p.locator('#custom-confirm-modal').waitFor({state:'visible'});await p.locator('#custom-confirm-cancel').click();}
async function form(p,pin){await p.getByRole('button',{name:'시험학생09 PIN 재설정',exact:true}).click();assert.equal(await p.locator('#student-pin-title').textContent(),'시험학생09 · PIN 재설정');await p.locator('#student-pin-new').fill(pin);await p.locator('#student-pin-confirm').fill(pin);}
async function saved(p){await p.waitForFunction(()=>document.getElementById('student-pin-msg').textContent.includes('재설정했어요.'),{},{timeout:30000});assert.equal(await p.locator('#student-pin-new').inputValue(),'');assert.equal(await p.locator('#student-pin-confirm').inputValue(),'');await p.locator('#student-pin-cancel').click();}
try{
 const tp=await page(),oldPage=await page({width:390,height:844});
 let oldShort,oldLong,peer,foreign,before,photoRef,likeBefore;
 await measure('teacher login → dashboard → students; original controls plus minimal reset button',async()=>{
  await uiLogin(tp,'가상교사','0042');teacherToken=await tp.evaluate(()=>OKGUAPI.getToken());
  await tp.locator('#teacher-nav-btn').click();await tp.locator('[data-tsub=students]').click();await tp.getByRole('button',{name:'시험학생09 PIN 재설정',exact:true}).waitFor();
  const overview=(await call(teacherToken,'getClassOverview')).value;targetId=overview.find(s=>s.name==='시험학생09').id;
 });
 await measure('capture pre-reset account, short/30-day sessions, existing diary/photo/comment/like',async()=>{
  await uiLogin(oldPage,'시험학생09','0042');oldShort=await oldPage.evaluate(()=>OKGUAPI.getToken());oldLong=(await login('시험학생09',true)).token;
  peer=(await login('시험학생02',true)).token;foreign=(await login('가상다른반교사')).token;
  const r=await fetch(origin+'/api/photos',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+oldShort,'X-Request-Id':randomUUID()},body:await readFile('fixtures/photo.png')});assert.equal(r.status,200);photoRef=(await r.json()).url;
  const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}),saved=await call(oldShort,'saveEntry',['',day,'🙂','좋아','#111','PIN 재설정 자료 보존 가상 기록 '+randomUUID(),false,true,false,JSON.stringify([photoRef]),'']);assert.equal(saved.status,200);kept.push(saved.value.id);
  assert.equal((await call(teacherToken,'addTeacherComment',['',saved.value.id,'PIN 재설정 전 가상 교사 댓글'])).status,200);
  assert.equal((await call(peer,'addComment',[saved.value.id,'','PIN 재설정 전 가상 학생 댓글'])).status,200);
  assert.equal((await call(peer,'toggleLike',[saved.value.id])).status,200);
  before=(await call(oldShort,'getEntry',[saved.value.id])).value;
  likeBefore=(await call(peer,'getBoard')).value.posts.find(p=>p.id===saved.value.id).likes;
 });
 await measure('anonymous/student/cross-class/teacher-target and invalid API requests denied',async()=>{
  const teacherId=(await call(teacherToken,'verifyToken')).value.id;
  for(const [token,id,status] of [['',targetId,401],[peer,targetId,403],[foreign,targetId,403],[teacherToken,teacherId,403]])assert.equal((await call(token,'resetStudentPin',[id,newPin,newPin])).status,status);
  for(const [pin,confirmation] of [['12','12'],['12a4','12a4'],['１２３４','１２３４'],[42,42],[newPin,'mismatch']])assert.equal((await call(teacherToken,'resetStudentPin',[targetId,pin,confirmation])).status,400);
  assert.equal((await call(oldLong,'verifyToken')).status,200);
 });
 let submissions=0;tp.on('request',r=>{if(r.url()===origin+'/api/rpc'&&r.postDataJSON()?.method==='resetStudentPin')submissions++;});
 await measure('UI format/mismatch do not send a request; failures preserve inputs for retry',async()=>{
  await form(tp,'12');await tp.locator('#student-pin-save').click();assert((await tp.locator('#student-pin-msg').textContent()).includes('숫자 4자리'));assert.equal(submissions,0);
  await tp.locator('#student-pin-new').fill(newPin);await tp.locator('#student-pin-confirm').fill('0042');await tp.locator('#student-pin-save').click();assert((await tp.locator('#student-pin-msg').textContent()).includes('일치하지'));assert.equal(submissions,0);
  await tp.locator('#student-pin-confirm').fill(newPin);
  // Synthetic transport error BEFORE reaching server: actual trial UI retry behavior.
  const fail=async route=>route.request().postDataJSON()?.method==='resetStudentPin'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,code:'E_SERVER',msg:'시험용 연결 오류입니다. 다시 시도해 주세요.'})}):route.continue();
  await tp.route('**/api/rpc',fail);await tp.locator('#student-pin-save').click();await tp.waitForFunction(()=>document.getElementById('student-pin-msg').textContent.includes('시험용 연결 오류'));
  assert.equal(await tp.locator('#student-pin-new').inputValue(),newPin);assert.equal(await tp.locator('#student-pin-confirm').inputValue(),newPin);assert(await tp.locator('#student-pin-save').isEnabled());assert.equal((await call(oldLong,'verifyToken')).status,200);await tp.unroute('**/api/rpc',fail);
 });
 let committedBody;
 await measure('UI retry + double click sends one successful reset; completion waits for real D1 response',async()=>{
  const requests=submissions;
  const wait=async route=>{if(route.request().postDataJSON()?.method!=='resetStudentPin')return route.continue();committedBody=route.request().postDataJSON();await new Promise(r=>setTimeout(r,700));return route.continue();};
  await tp.route('**/api/rpc',wait);
  await tp.locator('#student-pin-save').evaluate(b=>{b.click();b.click();});await tp.waitForFunction(()=>document.getElementById('student-pin-save').disabled);
  assert.equal(await tp.locator('#student-pin-msg').textContent(),'');assert(await tp.locator('#student-pin-new').isDisabled());
  mutated=true;await saved(tp);await tp.unroute('**/api/rpc',wait);assert.equal(submissions-requests,1);
 });
 await measure('old PIN rejected; old short and 30-day tokens revoked; other student/teachers retained',async()=>{
  assert.equal((await call('','login',['시험학생09','0042',false])).status,401);
  for(const token of [oldShort,oldLong])assert.equal((await call(token,'verifyToken')).status,401);
  for(const token of [peer,teacherToken,foreign])assert.equal((await call(token,'verifyToken')).status,200);
  await oldPage.reload();await oldPage.locator('#login-screen').waitFor({state:'visible'});assert.equal(await oldPage.evaluate(()=>OKGUAPI.getToken()),'');
 });
 let newToken;
 await measure('student logs in with leading-zero new PIN in deployed browser; CPU 1102 absent',async()=>{
  await uiLogin(oldPage,'시험학생09',newPin);newToken=await oldPage.evaluate(()=>OKGUAPI.getToken());assert.equal((await call(newToken,'verifyToken')).value.id,targetId);
  assert.equal(await oldPage.locator('[data-okgu-pin-reset]').count(),0);
 });
 await measure('same IDs, diary body, photograph bytes, teacher/student comments and likes after reset',async()=>{
  const after=(await call(newToken,'getEntry',[kept[0]])).value;
  // Relative labels may cross a minute; compare every persisted content/link field.
  const content=e=>({id:e.id,studentName:e.studentName,date:e.date,text:e.text,photos:e.photos,version:e.version,timestamp:e.timestamp,isPublic:e.isPublic,isSecret:e.isSecret,isMeOnly:e.isMeOnly,teacherComments:e.teacherComments.map(c=>({id:c.id,teacher:c.teacher,text:c.text,parentId:c.parentId})),boardComments:e.boardComments.map(c=>({id:c.id,author:c.author,text:c.text,parentId:c.parentId}))});
  assert.deepEqual(content(after),content(before));assert.equal((await call(peer,'getBoard')).value.posts.find(p=>p.id===kept[0]).likes,likeBefore);
  const photo=await fetch(origin+'/api/photos/'+photoRef.slice(11),{headers:{Authorization:'Bearer '+newToken}});assert.equal(photo.status,200);assert.equal(createHash('sha256').update(Buffer.from(await photo.arrayBuffer())).digest('hex'),createHash('sha256').update(await readFile('fixtures/photo.png')).digest('hex'));
  await oldPage.evaluate(()=>navButtonFor('stat').click());await oldPage.waitForFunction(()=>document.getElementById('stat-cal-card').querySelector('.mini-cal'));await oldPage.evaluate(()=>showStatDay(todayKey()));await oldPage.waitForFunction(id=>myEntries.some(e=>e.id===id),kept[0]);const item=oldPage.locator('[data-diary-id="'+kept[0]+'"]');await item.waitFor();await item.locator('img').waitFor();await item.scrollIntoViewIfNeeded();await oldPage.waitForFunction(id=>{const img=document.querySelector('[data-diary-id="'+id+'"] img');return img?.complete&&img.naturalWidth>0;},kept[0]);assert((await item.textContent()).includes('PIN 재설정 자료 보존 가상 기록'));
  await mkdir('.local/pin-reset',{recursive:true});await oldPage.screenshot({path:'.local/pin-reset/student-records.png',fullPage:true});
 });
 await measure('same request replay cannot revoke newly created student sessions or change PIN again',async()=>{
  assert.equal((await call(teacherToken,'resetStudentPin',committedBody.args,{requestId:committedBody.requestId})).status,200);assert.equal((await call(newToken,'verifyToken')).status,200);
 });
 await measure('teacher UI restores standard synthetic test PIN; restored browser login and records work',async()=>{
  await tp.setViewportSize({width:390,height:844});await form(tp,'0042');await tp.locator('#student-pin-save').click();await saved(tp);restored=true;
  assert.equal((await call(newToken,'verifyToken')).status,401);assert.equal((await call(teacherToken,'verifyToken')).status,200);assert.equal((await call(peer,'verifyToken')).status,200);
  await oldPage.evaluate(()=>{sessionStorage.removeItem('okgu_fast_token');localStorage.removeItem('okgu_fast_token');OKGUAPI.reset();});await uiLogin(oldPage,'시험학생09','0042');assert.equal((await call(await oldPage.evaluate(()=>OKGUAPI.getToken()),'getEntry',[kept[0]])).status,200);
 });
 assert.deepEqual(errors,[]);
}finally{
 // Preserve synthetic evidence records, restore usability even after interrupted checks.
 if(mutated&&!restored&&teacherToken&&targetId){const r=await call(teacherToken,'resetStudentPin',[targetId,'0042','0042']);restored=r.status===200;}
 await mkdir('.local/pin-reset',{recursive:true});await writeFile('.local/pin-reset/report.json',JSON.stringify({environment:origin.includes('127.0.0.1')?'local emulation; NOT service measurements':'deployed Cloudflare trial',origin,browser:'Linux Chromium; desktop and mobile viewport; no physical phone',results,errors,restoredStandardSyntheticPIN:restored,syntheticEvidenceDiaryIds:kept,security:'No PINs or tokens in report; generated alternate PIN held only in memory; no production data or pushes'},null,2)+'\n');
 for(const context of contexts)await context.close();await browser.close();
 if(mutated&&!restored)throw new Error('E_SYNTHETIC_PIN_RESTORE_REQUIRED');
}
