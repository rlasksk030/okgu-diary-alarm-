import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
const old=execFileSync('git',['show','964985d:index.html'],{encoding:'utf8'});
const legacyServer=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.searchParams.has('legacy-test')){res.setHeader('Content-Type','text/html');res.end(old);return;}
 const file=url.pathname.split('/').pop()||'index.html';
 if(!['index.html','config.js','rpc.js','fast-ui.js','student-pin.js','sw.js','manifest.json','okgu_icon.png'].includes(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'application/json');res.end(await readFile(file));
 }catch{res.writeHead(500).end();}});
await new Promise(resolve=>legacyServer.listen(3091,'127.0.0.1',resolve));
const base='http://127.0.0.1:3020/okgu-diary-alarm-/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox'],env:{...process.env,XDG_CONFIG_HOME:'/tmp/okgu-chromium-config',XDG_CACHE_HOME:'/tmp/okgu-chromium-cache'}});
try{
 const context=await browser.newContext();let upstreamGas=0;
 await context.route(/https:\/\/script\.(?:google|googleusercontent)\.com\//,route=>{upstreamGas++;return route.abort();});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const legacyBase='http://127.0.0.1:3091/okgu-diary-alarm-/';
 await page.goto(legacyBase);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
 await page.waitForFunction(()=>navigator.serviceWorker.controller);
 // Fulfill the actual old production document, under the unchanged app scope.
 await page.goto(legacyBase+'?legacy-test');
 const rejected=await page.evaluate(()=>new Promise(resolve=>{
  document.getElementById('diary-text').value='구버전 초안 보존 검사';
  google.script.run.withSuccessHandler(()=>resolve({unexpectedSuccess:true})).withFailureHandler(e=>resolve({error:e.message,draft:document.getElementById('diary-text').value})).saveEntry('fake','2026-10-04','🙂','좋아','#111','must not reach GAS',false,false,false,'[]','');
 }));
 assert.match(rejected.error,/아직 저장되지/);assert.equal(rejected.draft,'구버전 초안 보존 검사');assert.equal(upstreamGas,0);
 await page.goto(base);await page.locator('#li-name').fill('시험학생11');await page.locator('#li-pin').fill('0042');await page.locator('#login-btn').click();await page.waitForFunction(()=>typeof currentUser!=='undefined'&&!!currentUser);
 await page.waitForFunction(()=>document.getElementById('main-app').style.display!=='none');
 const marker='Cloud 전환 브라우저 '+Date.now();
 await page.evaluate(marker=>{document.getElementById('diary-text').value=marker;document.getElementById('diary-date').value=todayKey();curMood={emoji:'🙂',label:'좋아',color:'#111'};},marker);
 const response=page.waitForResponse(r=>r.url().endsWith('/api/rpc')&&r.request().postDataJSON()?.method==='saveEntry');
 await page.locator('#save-btn').click();const saved=await (await response).json();assert(saved.id);
 await page.waitForFunction(id=>myEntries.some(e=>e.id===id),saved.id);
 await page.reload();await page.waitForFunction(id=>myEntries.some(e=>e.id===id),saved.id);
 await page.evaluate(()=>{document.getElementById('diary-text').value='실패시 보존할 초안';curMood={emoji:'🙂',label:'좋아',color:'#111'};});
 await page.route('**/api/rpc',route=>route.request().postDataJSON().method==='saveEntry'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,code:'E_SERVER',msg:'저장 실패 검증'})}):route.continue());
 let failure='';page.on('dialog',async d=>{failure=d.message();await d.accept();});
 await page.locator('#save-btn').click();await page.waitForFunction(()=>!_saveInProgress);
 assert.equal(await page.locator('#diary-text').inputValue(),'실패시 보존할 초안');assert.match(failure,/저장/);assert.equal(upstreamGas,0);
 await writeFile('docs/검증/cloud-cutover-browser-local-20261004.json',JSON.stringify({checkedAt:new Date().toISOString(),legacyJsonpBlocked:true,legacyDraftPreserved:true,gasNetworkRequests:upstreamGas,cloudSave:true,immediateList:true,reload:true,failedSaveDraftPreserved:true,pageErrors:errors},null,2)+'\n');
 console.log(JSON.stringify({legacyJsonpBlocked:true,cloudSave:true,reload:true,failureDraftPreserved:true,upstreamGas,errors}));
}finally{await browser.close();await new Promise(resolve=>legacyServer.close(resolve));}
