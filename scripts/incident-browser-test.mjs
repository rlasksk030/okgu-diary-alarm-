import {chromium} from 'playwright';import {browserOptions} from './lib/browser-options.mjs';import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const base='http://127.0.0.1:3047/okgu-diary-alarm-/',origin=new URL(base).origin;
let release='cf-20261004-recovery',bundle=release,writes=0,failRelease=false;
const results=[],errors=[],browser=await chromium.launch(browserOptions(base));
const context=await browser.newContext({serviceWorkers:'block',timezoneId:'Asia/Seoul'});
const item={id:'canonical-entry',legacyId:'legacy-entry',date:'2026-10-04',studentName:'가상학생',text:'알림 대상 가상 글',moodEmoji:'🙂',moodLabel:'좋아',moodColor:'#111',photos:[],teacherComments:[],boardComments:[],timestamp:Date.parse('2026-10-04T08:23:14Z'),version:1};
await context.route('**/*',async route=>{
 const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();
 if(u.pathname.endsWith('/app-release.json'))return route.fulfill({status:failRelease?503:200,json:{version:release,apiOrigin:origin}});
 if(u.pathname.endsWith('/config.js'))return route.fulfill({contentType:'text/javascript',body:'window.OKGU_CONFIG='+JSON.stringify({version:bundle,apiOrigin:origin})});
 if(u.pathname==='/api/rpc'){const b=route.request().postDataJSON();if(b.method==='getEntry')return route.fulfill({json:item});writes++;return route.fulfill({json:{success:true}});}
 const name=u.pathname.endsWith('/')?'index.html':u.pathname.split('/').pop();
 if(!['index.html','rpc.js','fast-ui.js','app-update.js','student-pin.js','manifest.json','okgu_icon.png'].includes(name))return route.fulfill({status:404,body:''});
 return route.fulfill({body:await readFile(name),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.html')?'text/html':name.endsWith('.png')?'image/png':'application/json'});
});
try{
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());await page.goto(base);
 const login=async(id='student')=>{await page.evaluate(id=>{window.afterLogin=()=>{};_applyLoginSuccess({id,name:id==='student'?'가상학생':'다른가상학생',role:'학생'});},id);};
 await login();await page.evaluate(()=>{document.getElementById('diary-text').value='업데이트 중 보존할 초안';document.getElementById('quick-line').value='한줄 초안';document.getElementById('praise-msg').value='칭찬 초안';document.getElementById('chk-meonly').checked=true;pendingPhotos=[{id:'synthetic-photo',base64:'data:image/png;base64,aGVsbG8=',localUrl:'data:image/png;base64,aGVsbG8=',thumbnail:new Blob(['test'])}];editingEntryId='edit-id';window._fastEditingVersion=7;const card=document.createElement('div');card.dataset.diaryId='draft-entry';card.innerHTML='<input id=tc-input-0>';document.body.appendChild(card);card.querySelector('input').value='작성 중 댓글';});
 failRelease=true;
 assert.equal(await page.evaluate(async()=>{try{await OKGUAPI.call('saveEntry',[]);return 'sent';}catch(e){return e.code;}}),'E_UPDATE_CHECK');assert.equal(writes,0);
 failRelease=false;release='next-fixture-version';await page.evaluate(()=>OKGUUpdate.check(true));
 assert.equal(await page.evaluate(async()=>{try{await OKGUAPI.call('saveEntry',[]);return 'sent';}catch(e){return e.code;}}),'E_VERSION');assert.equal(writes,0);
 results.push('stale/offline version checks block writes without discarding the draft');
 const oldUrl=page.url();await page.evaluate(()=>{_saveInProgress=true;});await page.getByText('내용 보관 후 업데이트',{exact:true}).click();assert.equal(page.url(),oldUrl);await page.evaluate(()=>{_saveInProgress=false;});
 bundle=release;await Promise.all([page.waitForURL('**__okgu_release=*'),page.getByText('내용 보관 후 업데이트',{exact:true}).click()]);
 await login('other');assert.equal(await page.locator('#diary-text').inputValue(),'');await login();await page.waitForFunction(()=>document.getElementById('diary-text').value==='업데이트 중 보존할 초안');
 const restored=await page.evaluate(()=>({quick:document.getElementById('quick-line').value,praise:document.getElementById('praise-msg').value,private:document.getElementById('chk-meonly').checked,photo:pendingPhotos[0].base64,blob:pendingPhotos[0].thumbnail instanceof Blob,edit:editingEntryId,version:window._fastEditingVersion}));
 assert.equal(restored.quick,'한줄 초안');assert.equal(restored.praise,'칭찬 초안');assert(restored.private&&restored.blob);assert.equal(restored.photo,'data:image/png;base64,aGVsbG8=');assert.equal(restored.edit,'edit-id');assert.equal(restored.version,7);
 await page.evaluate(()=>{const card=document.createElement('div');card.dataset.diaryId='draft-entry';card.innerHTML='<input id=tc-input-8>';document.body.appendChild(card);});await page.waitForFunction(()=>document.getElementById('tc-input-8').value==='작성 중 댓글');
 results.push('explicit update waits for draft commit; text, scope, photos/Blob, edit version survive; another account cannot restore them');
 await page.evaluate(()=>{_pendingDeepLink={open:'diary',id:'legacy-entry',handled:false};tryDeepLinkAfterRender();});
 await page.waitForFunction(()=>_pendingDeepLink?.handled===true);assert.equal(await page.locator('[data-diary-id="canonical-entry"]').count(),1);
 results.push('legacy notification ID resolves and renders the canonical diary beyond the loaded list');
 await page.evaluate(()=>{currentUser.role='선생님';document.getElementById('scr-dash').classList.add('active');_currentTeacherSubTab='feed';document.getElementById('feed-list').innerHTML='<input value=댓글초안>';window.__refreshes=0;window.loadFeed=()=>window.__refreshes++;window.dispatchEvent(new Event('focus'));});assert.equal(await page.evaluate(()=>__refreshes),0);await page.evaluate(()=>{document.querySelector('#feed-list input').value='';window.dispatchEvent(new Event('focus'));});assert.equal(await page.evaluate(()=>__refreshes),1);results.push('resume revalidates the teacher feed but preserves an active comment draft');
 release='fixture-after-recovery';await page.evaluate(()=>OKGUUpdate.check(true));const beforeFailure=page.url();await page.evaluate(()=>{indexedDB.open=()=>{throw Error('quota test');};});await page.getByText('내용 보관 후 업데이트',{exact:true}).click();assert.equal(page.url(),beforeFailure);assert.equal(await page.locator('#diary-text').inputValue(),'업데이트 중 보존할 초안');results.push('failed draft persistence does not navigate or clear current content');
 assert.deepEqual(errors,[]);
}finally{await context.close();await browser.close();}
await writeFile('docs/검증/incident-browser-20261004.json',JSON.stringify({checkedAt:new Date().toISOString(),environment:'Linux Chromium, intercepted synthetic responses only',physicalPwa:false,productionWrites:0,results},null,2)+'\n');console.log(JSON.stringify({passed:results.length,productionWrites:0}));
