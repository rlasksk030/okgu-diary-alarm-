// All browser requests are intercepted. Only synthetic in-memory accounts are used.
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import worker from '../worker/index.ts';
import {fixture} from '../tests/helpers/praise.mjs';
const f=await fixture(),site=f.env.APP_URL,api='https://okgu-diary-api.rlasksk030.workers.dev';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox'],env:{...process.env,XDG_CONFIG_HOME:'/tmp/okgu-chromium-config',XDG_CACHE_HOME:'/tmp/okgu-chromium-cache'}});
let chain=Promise.resolve(),failure='',calls=[],pageErrors=[],gas=0,delayedResolve;
try{
 async function pageFor(id){
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.addInitScript(id=>sessionStorage.setItem('okgu_fast_token','test-'+id),id);
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(/script\.(google|googleusercontent)\.com/.test(url.hostname))gas++;
   if(request.url().startsWith(api+'/api/')){
    chain=chain.then(async()=>{
     const body=request.postDataJSON();
     if(body?.method==='sendPraise'){
      assert.equal(request.method(),'POST');assert.equal(url.search,'');calls.push(body);
      if(failure==='reject'){failure='';return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,code:'E_MAINTENANCE',msg:'시험 점검으로 저장이 중지됐어요.'})});}
      if(failure==='delay'){failure='';await new Promise(resolve=>delayedResolve=resolve);}
     }
     const response=await worker.fetch(new Request(request.url(),{method:request.method(),headers:await request.allHeaders(),body:request.postDataBuffer()||undefined}),f.env,{waitUntil:p=>p.catch(()=>{})});
     if(body?.method==='sendPraise'&&failure==='lost'){failure='';return route.abort('failed');}
     await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
    });await chain;return;
   }
   if(request.url().startsWith(site)){
    const file=url.pathname.split('/').pop()||'index.html';
    if(!['index.html','config.js','rpc.js','fast-ui.js','student-pin.js','manifest.json','okgu_icon.png'].includes(file))return route.abort();
    await route.fulfill({body:await readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'application/octet-stream'});return;
   }
   await route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.addLocatorHandler(page.locator('#custom-confirm-modal'),()=>page.locator('#custom-confirm-cancel').click());
  await page.goto(site);await page.waitForFunction(()=>typeof currentUser!=='undefined'&&!!currentUser);
  return page;
 }
 async function praiseScreen(page){await page.evaluate(()=>goTo('praise','칭찬함','',navButtonFor('praise')));await page.waitForFunction(()=>!!document.querySelector('#praise-to option[value="검증친구"]'));}
 async function compose(page,text){await page.selectOption('#praise-to','검증친구');await page.fill('#praise-msg',text);}
 async function send(page){const response=page.waitForResponse(r=>r.url()===api+'/api/rpc'&&r.request().postDataJSON()?.method==='sendPraise');await page.click('.praise-send-btn');const result=await response;await page.waitForFunction(()=>!_praiseSending);return result.json();}
 const student=await pageFor('s');await praiseScreen(student);
 await compose(student,'짧은 칭찬 😊');const short=await send(student);assert(short.id);assert.match(await student.locator('#praise-send-msg').textContent(),/저장.*승인/);
 const long='  '+('함께해 줘서 고마워! 😊\n다음에도 잘 부탁해 👨‍👩‍👧‍👦\n').repeat(160)+' 끝\n ';
 await compose(student,long);assert.match(await student.locator('#praise-length').textContent(),new RegExp([...long].length.toLocaleString('ko-KR')));
 failure='reject';await send(student);assert.equal(await student.locator('#praise-msg').inputValue(),long);assert.match(await student.locator('#praise-send-msg').textContent(),/시험 점검.*E_MAINTENANCE/);
 const countBefore=f.sqlite.prepare('SELECT count(*) n FROM praises').get().n;
 failure='lost';await student.click('.praise-send-btn');await student.waitForFunction(()=>!_praiseSending);assert.equal(await student.locator('#praise-msg').inputValue(),long);
 const requestBefore=calls.at(-1).requestId;
 const saved=await send(student);assert.equal(calls.at(-1).requestId,requestBefore);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM praises').get().n,countBefore+1);assert.equal(f.sqlite.prepare('SELECT body FROM praises WHERE id=?').get(saved.id).body,long);
 const teacher=await pageFor('t');await teacher.evaluate(()=>{goTo('dash','교사 대시보드','',navButtonFor('dash'));switchTeacherSubTab('praise');});await teacher.waitForFunction(id=>praiseModItems.some(p=>p.id===id),saved.id);
 assert.equal(await teacher.locator('#ds-praise-list .pmsg').filter({hasText:'함께해 줘서'}).textContent(),long);
 const approval=teacher.waitForResponse(r=>r.url()===api+'/api/rpc'&&r.request().postDataJSON()?.method==='setPraiseStatus');await teacher.locator(`button[onclick="approvePraise('${saved.id}')"]`).click();assert.equal((await (await approval).json()).success,true);
 const recipient=await pageFor('p');await recipient.evaluate(()=>goTo('praise','칭찬함','',navButtonFor('praise')));await recipient.waitForFunction(id=>praiseData?.received.some(p=>p.id===id),saved.id);
 assert.equal(await recipient.locator('#praise-list .pmsg').filter({hasText:'함께해 줘서'}).textContent(),long);assert.equal(await recipient.locator('#praise-list .pmsg').first().evaluate(el=>getComputedStyle(el).whiteSpace),'pre-wrap');
 await compose(student,'전송 중 초안');failure='delay';await student.click('.praise-send-btn');await student.waitForFunction(()=>_praiseSending);await student.evaluate(()=>sendPraiseMsg());await student.fill('#praise-msg','전송 중 새로 작성한 내용');while(!delayedResolve)await new Promise(r=>setTimeout(r,10));delayedResolve();await student.waitForFunction(()=>!_praiseSending);assert.equal(await student.locator('#praise-msg').inputValue(),'전송 중 새로 작성한 내용');assert.equal(f.sqlite.prepare("SELECT count(*) n FROM praises WHERE body='전송 중 초안'").get().n,1);
 assert.equal(gas,0);assert.deepEqual(pageErrors,[]);
 console.log(JSON.stringify({syntheticOnly:true,liveStudentWrites:0,livePushes:0,buttonToCloudJSON:true,shortAndLongStored:true,teacherApproval:true,recipientFullBody:true,errorDraftPreserved:true,lostResponseRetryDeduplicated:true,doubleClickDeduplicated:true,newDraftPreserved:true,gasRequests:gas,pageErrors}));
}finally{await browser.close();await f.finish();}
