import {chromium} from 'playwright';import {browserOptions} from './lib/browser-options.mjs';import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const base='https://rlasksk030.github.io/okgu-diary-alarm-/',candidate=await readFile('index.html','utf8'),baseline=execFileSync('git',['show','origin/main:index.html'],{encoding:'utf8'}),results=[];
const browser=await chromium.launch(browserOptions(base));
try{
 for(const [variant,html] of [['main',baseline],['candidate',candidate]]){
  const context=await browser.newContext({serviceWorkers:'block',timezoneId:'Asia/Seoul'});await context.addInitScript(()=>{window.__calls=[];window.google={script:{get run(){let success,failure;const p={withSuccessHandler(f){success=f;return p;},withFailureHandler(f){failure=f;return p;},getRecentEntries(...args){window.__calls.push({success,failure,args});},verifyToken(){success({success:true,role:'선생님'});}};return p;}}};});
  await context.route('**/*',route=>route.request().url()===base?route.fulfill({contentType:'text/html',body:html}):route.fulfill({body:'',status:200}));const page=await context.newPage();await page.goto(base);
  await page.evaluate(()=>{currentUser={name:'가상교사',role:'선생님'};document.getElementById('login-screen').style.display='none';document.getElementById('main-app').style.display='block';document.getElementById('scr-dash').classList.add('active');loadFeed();loadFeed();__calls[0].success([{id:'synthetic-old',studentName:'가상학생',date:'2026-10-03',text:'가상 이전 기록'}]);});
  assert.equal(await page.evaluate(()=>__calls.length),variant==='main'?1:2);
  if(variant==='candidate'){assert.equal(await page.locator('[data-diary-id=synthetic-old]').count(),0);await page.evaluate(()=>__calls[1].success([{id:'synthetic-new',studentName:'가상학생',date:'2026-10-03',text:'가상 최신 기록'}]));assert.equal(await page.locator('[data-diary-id=synthetic-new]').count(),1);results.push({check:'queued refresh shows newest response, suppresses older DOM',passed:true});}
  else results.push({check:'baseline stale feed reproduced in Chromium',passed:true});
  if(variant==='candidate'){
   const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>{window.__calls=[];Object.defineProperty(google.script,'run',{get(){let success,failure;const p={withSuccessHandler(f){success=f;return p;},withFailureHandler(f){failure=f;return p;},verifyToken(){success({success:true,role:'선생님'});},getRecentEntries(){failure(new Error('getRecentEntries is not defined'));}};return p;},configurable:true});});
   // VM test covers success shape; here exercise a real browser's private download.
   await page.evaluate(await readFile('scripts/teacher-feed-diagnostic.js','utf8'));const download=await downloadPromise;const stream=await download.createReadStream();let data='';for await(const chunk of stream)data+=chunk;
   const report=JSON.parse(data);assert.equal(report.requests[1].errorCategory,'FEED_METHOD_NOT_DEFINED');assert.equal(report.teacherSessionValid,true);assert(!data.includes('가상교사'));assert(!data.includes('okgu_token'));assert(!data.includes('synthetic-new'));results.push({check:'owner diagnostic download excludes names/body/IDs/tokens; classifies server error',passed:true});
  }
  await context.close();
 }
}finally{await browser.close();}
await writeFile('docs/검증/feed-browser-regression-20261003.json',JSON.stringify({checkedAt:new Date().toISOString(),environment:'Linux Chromium intercepted app; synthetic only; NOT live incident confirmation',results},null,2)+'\n');console.log(JSON.stringify({checks:results.length,passed:true,realStudentDataUsed:false,physicalPhoneVerified:false}));
