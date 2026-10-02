import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
// No operational network or account access: both UIs use the same synthetic fixture.
const baseline=process.env.OKGU_UI_MAIN_COMMIT||'964985d3ff683617de18e89f71521f2c224d50f2';
const main=execFileSync('git',['show',baseline+':index.html'],{encoding:'utf8'}),trial=await readFile('index.html','utf8');
const css=html=>[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]);
assert.deepEqual(css(trial),css(main),'Main application and yearbook CSS must match');
const staticHTML=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/>\s+</g,'><').trim();
assert.equal(staticHTML(trial),staticHTML(main),'Static design, copy, controls and layout must match main');
const fixture=config=>{
 const fixed=Date.parse('2026-10-03T10:00:00+09:00'),NativeDate=Date;
 window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};Math.random=()=>0.25;
 const entries=[{id:'diary-fixture-1',studentName:'시험학생01',date:'2026-10-03',moodEmoji:'😄',moodLabel:'신남',moodColor:'#111',text:'가상 기록: 친구와 즐겁게 지냈다.',photos:[],isPublic:true,isSecret:false,isMeOnly:false,version:1,timestamp:fixed-3600000,savedTime:'10월 3일 오전 9:00',savedAt:'1시간 전',timeHM:'09:00',teacherComments:[{id:'comment-fixture',teacher:'가상교사',role:'선생님',text:'가상 선생님 댓글',time:'방금',timeHM:'10:00',parentId:''}],boardComments:[]},{id:'diary-fixture-2',studentName:'시험학생01',date:'2026-10-02',moodEmoji:'🙂',moodLabel:'좋아',moodColor:'#111',text:'가상 기록: 어제의 마음.',photos:[],isPublic:false,isSecret:true,isMeOnly:false,version:1,timestamp:fixed-86400000,savedTime:'10월 2일 오전 10:00',savedAt:'어제',timeHM:'10:00',teacherComments:[],boardComments:[]}];
 const stats={total:2,totalDays:2,streak:2,counts:{'😄':1,'🙂':1},days:['2026-10-03','2026-10-02']};
 if(config?.sameDay){entries.push({...entries[0],id:'diary-fixture-3',text:'가상 같은 날 먼저 쓴 일기',timestamp:fixed-7200000,teacherComments:[],savedTime:'10월 3일 오전 8:00',timeHM:'08:00'});stats.total=3;stats.counts['😄']=2;}
 const messages=[{id:'praise-fixture-1',from:'시험학생02',to:'시험학생01',msg:'가상 칭찬 내용',time:'1시간 전',read:false,status:'approved',anonymous:false},{id:'praise-fixture-2',from:'시험학생01',to:'시험학생02',msg:'가상 보낸 칭찬',time:'어제',read:true,status:'pending',anonymous:true}];
 const overview=[{id:'fixture-student-1',name:'시험학생01',wroteToday:true,totalDays:2,streak:2,lastMood:'😄'},{id:'fixture-student-2',name:'시험학생02',wroteToday:false,totalDays:0,streak:0,lastMood:''}];
 const flags={'시험학생02':{counsel:true,memo:'가상 상담 메모'}};
 const push={items:overview.map(s=>({name:s.name,enabled:false})),total:2,enabled:0,success:true};
 const praise={received:[messages[0]],sent:[messages[1]],counts:{received:1,sent:1,unread:1,pending:1},hasMore:false};
 window.__fixtureCalls=[];window.__fixtureDelay=0;window.__fixtureError='';
 window.__fixtureCall=async(method,args=[],extra={})=>{window.__fixtureCalls.push(method);await new Promise(r=>setTimeout(r,window.__fixtureDelay));if(window.__fixtureError===method)throw new Error('가상 연결 오류');
 const own=window.__fixtureRole==='선생님'||window.__fixtureEmpty?[]:structuredClone(entries);
 switch(method){
 case 'login':case 'verifyToken':return {success:true,name:window.__fixtureRole==='선생님'?'가상교사':'시험학생01',role:window.__fixtureRole,cls:'옥구초 6학년',token:'synthetic-ui-fixture'};
 case 'getMyEntries':return own.sort((a,b)=>a.timestamp-b.timestamp);
 case 'getStudentDashboard':return {entries:own,nextOffset:null,teacherCommentMap:{},stats:own.length?stats:{...stats,total:0,streak:0,totalDays:0,counts:{},days:[]},allStats:own.length?stats:{...stats,total:0,streak:0,totalDays:0,counts:{},days:[]}};
 case 'searchEntries':return {entries:own.filter(e=>e.text.includes(args[0])),total:own.filter(e=>e.text.includes(args[0])).length,hasMore:false};
 case 'getPraise':return structuredClone(praise);
 case 'markPraiseRead':return {success:true};
 case 'getStudents':return ['시험학생01','시험학생02','가상교사'];
 case 'getClassOverview':return window.__fixtureNoStudents?[]:overview;
 case 'getClassMoodStats':return {counts:stats.counts,total:2};
 case 'listStudentFlags':return {success:true,flags};
 case 'getMoodTrend':return {success:true,points:[{date:'2026-10-02',avg:4,count:1},{date:'2026-10-03',avg:5,count:1}]};
 case 'listAllPraiseForTeacher':{const items=extra.filter&&extra.filter!=='all'?messages.filter(p=>p.status===extra.filter):messages;return {success:true,items,counts:{pending:1},hasMore:false};}
 case 'getTeacherDashboardBundle':return {overview,flags,mood:{counts:stats.counts,total:2},trend:[{date:'2026-10-02',avg:4,count:1},{date:'2026-10-03',avg:5,count:1}],praise:messages.filter(p=>p.status==='pending'),praisePage:{counts:{pending:1},hasMore:false},push};
 case 'getPushSubscriptionStatus':return push;
 case 'getMyPushStatus':return {success:true,enabled:false};
 case 'getNotifications':return {success:true,items:[]};
 case 'getStudentEntries':return window.__fixtureEmpty||args[1]==='시험학생02'?[]:structuredClone(entries);
 case 'getRecentEntries':return structuredClone(entries);
 case 'exportEntries':return {entries:window.__fixtureEmpty||args[0]==='시험학생02'?[]:own.length?own:structuredClone(entries)};
 case 'getBoard':return {posts:[{id:'board-fixture',author:'시험학생01',text:entries[0].text,mood:'😄',date:'10월 3일',timeHM:'09:00',photos:[],likes:1,liked:false,comments:[{id:'board-comment-fixture',author:'시험학생02',text:'가상 친구 댓글',time:'방금',timeHM:'10:00',parentId:''}]}],hasMore:false};
 default:throw new Error('Unhandled synthetic method '+method);
 }};
 const runner=()=>{let success,failure,proxy;proxy=new Proxy({},{get(t,key){if(key==='withSuccessHandler')return f=>{success=f;return proxy;};if(key==='withFailureHandler')return f=>{failure=f;return proxy;};return (...args)=>{window.__fixtureCall(String(key),args).then(success).catch(e=>failure?.(e));};}});return proxy;};
 window.google={script:{}};Object.defineProperty(window.google.script,'run',{get:runner});
 window.OKGUAPI={call:window.__fixtureCall,getToken:()=>window.__fixtureLoggedIn?'synthetic-ui-fixture':'',reset:()=>{},versions:new Map(),request:()=>{throw new Error('No external photo fixture');}};
};
const origin='http://127.0.0.1:3060',base=origin+'/okgu-diary-alarm-/';
const out='.local/ui-comparison/'+(process.env.OKGU_UI_REPORT||'latest');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const cases=[],errors=[];
async function snapshot(page){return page.evaluate(()=>[...document.body.querySelectorAll('*')].filter(el=>el.checkVisibility({checkVisibilityCSS:true})&&el.getBoundingClientRect().width&&el.getBoundingClientRect().height).map(el=>{const box=el.getBoundingClientRect(),style=getComputedStyle(el);return {tag:el.tagName,id:el.id,cls:el.getAttribute('class')||'',text:[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(''),placeholder:el.getAttribute('placeholder')||'',type:el.getAttribute('type')||'',value:['INPUT','TEXTAREA','SELECT'].includes(el.tagName)?el.value:'',rect:[box.x,box.y,box.width,box.height].map(x=>Math.round(x*100)/100),font:[style.fontFamily,style.fontSize,style.fontWeight,style.color,style.backgroundColor,style.borderRadius]};}));}
try{for(const viewport of (process.env.OKGU_UI_SAME_DAY?[{width:390,height:844}]:[{width:390,height:844},{width:1365,height:900}]))for(const role of (process.env.OKGU_UI_SAME_DAY?['학생']:['학생','선생님'])){
 const pages=[];for(const [variant,html] of [['main',main],['trial',trial]]){const context=await browser.newContext({viewport,timezoneId:'Asia/Seoul',serviceWorkers:'block'});await context.addInitScript(fixture,{sameDay:!!process.env.OKGU_UI_SAME_DAY});await context.addInitScript(r=>{window.__fixtureRole=r;},role);await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();if(url.pathname.endsWith('index.html')||url.pathname.endsWith('/'))return route.fulfill({contentType:'text/html',body:html});if(url.pathname.endsWith('/rpc.js'))return route.fulfill({contentType:'text/javascript',body:'/* fixture bridge was injected before HTML */'});if(url.pathname.endsWith('/config.js'))return route.fulfill({contentType:'text/javascript',body:'window.OKGU_CONFIG={apiOrigin:"'+origin+'",vapidPublicKey:""};'});if(url.pathname.endsWith('/student-pin.js'))return route.fulfill({contentType:'text/javascript',body:await readFile('student-pin.js','utf8')});if(url.pathname.endsWith('/fast-ui.js'))return route.fulfill({contentType:'text/javascript',body:await readFile('fast-ui.js','utf8')});return route.abort();});const page=await context.newPage();page.on('pageerror',e=>errors.push({variant,role,message:e.message}));page.on('dialog',d=>d.dismiss());await page.goto(base);await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;}[data-okgu-pin-reset]{display:none!important;}'});pages.push({page,context,variant});}
 async function check(name,action){for(const {page} of pages){if(action)await action(page);await page.waitForTimeout(100);}const a=await snapshot(pages[0].page),b=await snapshot(pages[1].page);const equal=JSON.stringify(a)===JSON.stringify(b);const label=viewport.width+'-'+(role==='학생'?'student':'teacher')+'-'+name;const differences=[];for(let i=0;i<Math.max(a.length,b.length);i++)if(JSON.stringify(a[i])!==JSON.stringify(b[i]))differences.push({index:i,main:a[i],trial:b[i]});cases.push({name:label,equal,differences:differences.slice(0,8)});for(const {page,variant} of pages)await page.screenshot({path:out+'/'+label+'-'+variant+'.png',fullPage:true});console.log(equal?'MATCH':'DIFF',label,differences.length);}
 await check('login');
 await check('login-name-validation',p=>p.locator('#login-btn').click());
 for(const {page} of pages){await page.locator('#li-name').fill(role==='학생'?'시험학생01':'가상교사');await page.locator('#li-pin').fill('0042');await page.locator('#login-btn').click();await page.locator('#main-app').waitFor({state:'visible'});await page.evaluate(()=>{window.__fixtureLoggedIn=true;});await page.waitForTimeout(1300);if(await page.locator('#custom-confirm-modal').isVisible())await page.locator('#custom-confirm-cancel').click();}
 await check('write');await check('quick',p=>p.locator('#qm-quick').click());await check('write-helper',async p=>{await p.locator('#qm-full').click();await p.locator('#writing-helper').evaluate(el=>el.open=true);});
 await check('avatar',p=>p.locator('#user-av').click());await check('pin-sheet',p=>p.evaluate(()=>openPinSheet()));for(const {page} of pages)await page.evaluate(()=>closePinSheet());
 for(const tab of ['board','search','stat','praise']){await check(tab,p=>p.evaluate(id=>{navButtonFor(id).click();},tab));if(tab==='search'){await check('search-result',async p=>{await p.locator('#search-input').fill('가상 기록');await p.locator('#scr-search .search-btn').first().click();});}if(tab==='stat'){await check('stat-day',p=>p.evaluate(()=>showStatDay('2026-10-03')));for(const period of ['month','all'])await check('stat-'+period,p=>p.locator('#scr-stat .stab').filter({hasText:period==='month'?'이번 달':'전체'}).click());}if(tab==='praise')await check('praise-sent',p=>p.locator('#scr-praise .ptab').filter({hasText:'보낸'}).click());}
 for(const {page} of pages)await page.evaluate(()=>{window.__fixtureDelay=2000;});
 await check('stat-loading',p=>p.evaluate(()=>navButtonFor('stat').click()));
 for(const {page} of pages)await page.waitForTimeout(2100);
 await check('praise-loading',p=>p.evaluate(()=>{praiseData=null;navButtonFor('praise').click();}));
 for(const {page} of pages)await page.waitForTimeout(2100);
 for(const {page} of pages)await page.evaluate(()=>{window.__fixtureDelay=0;window.__fixtureError='getPraise';});
 await check('praise-error',p=>p.evaluate(()=>loadPraise()));
 for(const {page} of pages)await page.evaluate(()=>{window.__fixtureError='';});
 if(role==='선생님'){await check('dashboard',p=>p.locator('#teacher-nav-btn').click());for(const tab of ['stats','students','praise'])await check('teacher-'+tab,p=>p.locator('[data-tsub="'+tab+'"]').click());await check('teacher-approved',p=>p.locator('#ds-praise-card .dptab').filter({hasText:'승인됨'}).click());await check('student-modal',p=>p.evaluate(()=>openStudentDiary('시험학생01')));for(const {page} of pages)await page.evaluate(()=>closeStudentModal());for(const {page} of pages)await page.evaluate(()=>{window.__fixtureDelay=2000;});await check('student-modal-loading',p=>p.evaluate(()=>openStudentDiary('시험학생01')));for(const {page} of pages){await page.waitForTimeout(2100);await page.evaluate(()=>{window.__fixtureDelay=0;closeStudentModal();});}}
 await check('logout-confirm',p=>p.evaluate(()=>doLogout()));for(const {page} of pages)await page.locator('#custom-confirm-cancel').click();
 for(const {page} of pages)await page.evaluate(()=>{window.__fixtureDelay=2000;document.getElementById('main-app').style.display='none';document.getElementById('login-screen').style.display='block';});
 await check('reconnect-loading',p=>p.evaluate(()=>tryAutoLogin()));for(const {page} of pages){await page.waitForTimeout(2100);await page.evaluate(()=>{window.__fixtureDelay=0;});}
 const previews=[];for(const {page} of pages){const pending=page.waitForEvent('popup');await page.evaluate(r=>r==='학생'?printMyYearbook():printClassYearbooks(),role);const popup=await pending;await popup.waitForFunction(()=>document.querySelector('.yprintbar button')&&!document.querySelector('.yprintbar button').disabled);previews.push(popup);}
 const printA=await snapshot(previews[0]),printB=await snapshot(previews[1]);const printEqual=JSON.stringify(printA)===JSON.stringify(printB);cases.push({name:viewport.width+'-'+(role==='학생'?'student':'teacher')+'-print-preview',equal:printEqual,differences:printEqual?[]:[{main:printA,trial:printB}]});console.log(printEqual?'MATCH':'DIFF',cases.at(-1).name);for(const [i,popup] of previews.entries()){await popup.screenshot({path:out+'/'+cases.at(-1).name+'-'+(i?'trial':'main')+'.png',fullPage:true});await popup.close();}
 if(role==='학생'){for(const {page} of pages)await page.evaluate(()=>{window.__fixtureEmpty=true;});await check('empty-stat',p=>p.evaluate(()=>navButtonFor('stat').click()));const messages=[];for(const {page} of pages){let message='';const handler=d=>{message=d.message();};page.on('dialog',handler);await page.evaluate(()=>printMyYearbook());page.off('dialog',handler);messages.push(message);}cases.push({name:viewport.width+'-student-empty-print-message',equal:messages[0]==='아직 작성한 일기가 없어요'&&messages[0]===messages[1],differences:messages});}
 else{for(const state of ['no-students','no-records']){const popups=[];for(const {page} of pages){await page.evaluate(s=>{window.__fixtureNoStudents=s==='no-students';window.__fixtureEmpty=s==='no-records';},state);const pending=page.waitForEvent('popup');await page.evaluate(()=>printClassYearbooks());const popup=await pending;await popup.waitForFunction(text=>document.body.textContent===text,state==='no-students'?'학생 목록을 불러오지 못했어요.':'아직 작성된 일기가 없어요.');popups.push(popup);}const a=await snapshot(popups[0]),b=await snapshot(popups[1]);cases.push({name:viewport.width+'-teacher-print-'+state,equal:JSON.stringify(a)===JSON.stringify(b),differences:JSON.stringify(a)===JSON.stringify(b)?[]:[{main:a,trial:b}]});for(const popup of popups)await popup.close();}}
 for(const {context} of pages)await context.close();
 }
}finally{await browser.close();}
const report={baseline,trialCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),fixture:'synthetic only; no GAS/production network, authentication, or student data',staticHTMLEqual:true,cssEqual:true,excludedNewFeature:'Only authorized teacher PIN reset buttons hidden for unchanged-layout comparison; reset feature verified separately',cases:cases.length,matches:cases.filter(x=>x.equal).length,errors,results:cases};await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log('UI comparison',report.matches+'/'+report.cases,'errors',errors.length);if(errors.length||report.matches!==report.cases)process.exitCode=1;
