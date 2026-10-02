import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {browserOptions} from './lib/browser-options.mjs';
import {requireTrialBranch} from './lib/trial-cloudflare.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
requireTrialBranch();
let saved;try{saved=JSON.parse(await readFile('.local/trial-deployment.json','utf8'));}catch{}
const origin=process.env.OKGU_TRIAL_API_ORIGIN||saved?.origin;
if(!origin||!/^https:\/\/[a-z0-9.-]+$/.test(origin)||origin==='https://rlasksk030.github.io')throw new Error('Actual isolated HTTPS trial URL required');
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch(browserOptions(origin)),samples=[];let failure;
try{for(let i=0;i<3;i++){
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'});
 try{
  const page=await context.newPage();let blockedWrites=0;
  await context.route('**/*',route=>{if(!['GET','HEAD'].includes(route.request().method())){blockedWrites++;return route.abort();}return route.continue();});
  const start=performance.now();const response=await page.goto(origin+'/okgu-diary-alarm-/',{waitUntil:'domcontentloaded',timeout:30000});const ms=Math.round(performance.now()-start);
  await page.locator('#login-screen').waitFor({state:'visible'});
  assert.equal(response.status(),200);assert.equal(await page.title(),'OKGU DIARY');assert.equal(blockedWrites,0);
  samples.push({ms,status:response.status(),title:await page.title(),loginScreenVisible:true,cfRay:response.headers()['cf-ray'],cacheStatus:response.headers()['cf-cache-status']||null,blockedWrites});
  if(i===0)await page.screenshot({path:'artifacts/cloudflare-trial-login-screen.png',fullPage:true});
 }finally{await context.close();}
}}catch(error){failure={name:error.name,code:/ERR_[A-Z_]+/.exec(error.message)?.[0]||'NAVIGATION_OR_UI_FAILED'};}finally{await browser.close();}
const sorted=samples.map(s=>s.ms).sort((a,b)=>a-b);
const report={at:new Date().toISOString(),environment:'actual deployed Cloudflare trial',URL:origin+'/okgu-diary-alarm-/',measurementLocation:'Codex cloud Linux Chromium via configured proxy; mobile viewport, not a physical student device',conditions:'3 sequential fresh browser contexts; DOMContentLoaded; no login attempted; writes blocked; no artificial throttling; cold Worker not inferred',tlsVerificationEnabled:true,samples,summary:sorted.length?{n:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],max:sorted.at(-1)}:null,failed:!!failure,...(failure?{failure}:{})};
await writeFile('artifacts/cloudflare-first-visit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(failure)process.exitCode=1;
