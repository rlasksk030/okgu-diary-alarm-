/* Existing DOM/CSS and UI renderers remain; only data and service handling change. */
(function(){
'use strict';
const api=window.OKGUAPI;
const originalSearch=doSearch,originalPrint=printMyYearbook,originalClassPrint=printClassYearbooks;
let summary=null,searchGeneration=0,viewGeneration=0,modalGeneration=0;
const printWindows=new Set();
const asPromise=(method,args,extra)=>api.call(method,args,extra);
window._getToken=api.getToken;
window.tryAutoLogin=function(){const token=api.getToken();if(!token)return;document.getElementById('login-screen').style.display='none';showLoading(true);asPromise('verifyToken',[token]).then(res=>_applyLoginSuccess({...res,token})).catch(e=>{if(e.code==='E_AUTH'){sessionStorage.removeItem('okgu_fast_token');localStorage.removeItem('okgu_fast_token');}document.getElementById('login-screen').style.display='block';}).finally(()=>showLoading(false));};
window.doLogout=function(){closeAvMenu();customConfirm('로그아웃할까요?',function(){api.logout().catch(()=>{});location.reload();});};
window._handleAuthErr=function(res){if(res&&res.code==='E_AUTH'){alert('로그인이 만료되었어요. 작성한 내용은 보관한 뒤 다시 로그인해 주세요.');return true;}return false;};
function chronological(entries){return entries.sort((a,b)=>(a.timestamp||0)-(b.timestamp||0));}
function applyData(data){myEntries=chronological(data.entries||[]);_teacherCommentMap=data.teacherCommentMap||{};summary=data.allStats||data.stats;window._fastStats=data.stats;}
async function dashboardData(period){const data=await asPromise('getStudentDashboard',[api.getToken(),currentUser.name],{period});for(let offset=data.nextOffset;offset!==null;){const page=await asPromise('getMyEntries',[],{period,offset});data.entries.push(...page);offset=page.length===50?offset+50:null;}data.teacherCommentMap=Object.fromEntries(data.entries.map(e=>[e.id,e.teacherComments]));return data;}
window.loadMyEntries=function(cb){const generation=++viewGeneration;dashboardData('month').then(data=>{if(generation!==viewGeneration)return;applyData(data);renderStreak();if(cb)cb();}).catch(e=>{console.error(e.code||e.message);if(cb)cb();});};
window.loadAndRenderStat=function(cb){for(const id of ['stat-mood-card','stat-cal-card'])document.getElementById(id).innerHTML='<div class="no-entry">불러오는 중...</div>';const generation=++viewGeneration;dashboardData(curStatPeriod).then(data=>{if(generation!==viewGeneration)return;applyData(data);renderStreakStat();renderStat(curStatPeriod);if(cb)cb();tryDeepLinkAfterRender();}).catch(()=>{if(generation!==viewGeneration)return;renderStreakStat();renderStat(curStatPeriod);if(cb)cb();tryDeepLinkAfterRender();});};
window.switchStat=function(el,period){document.querySelectorAll('.stab').forEach(t=>t.classList.remove('on'));el.classList.add('on');curStatPeriod=period;loadAndRenderStat();};
const streak=renderStreak,streakStat=renderStreakStat;
function withRecentDays(render){const before=myEntries;myEntries=[...before,...(summary?.days||[]).filter(day=>!before.some(e=>normDate(e.date)===day)).map(date=>({date}))];try{render();}finally{myEntries=before;}}
window.renderStreak=function(){withRecentDays(streak);const el=document.querySelector('#streak-area .streak-days');if(el&&summary){for(const n of [...el.childNodes])if(n.nodeType===3)n.textContent=' '+summary.streak+'일 연속';}};
window.renderStreakStat=function(){withRecentDays(streakStat);if(summary&&summary.streak){const root=document.getElementById('streak-stat-area');const days=root.querySelector('.streak-days'),label=root.querySelector('.streak-label');if(days)days.textContent='🔥 '+summary.streak+'일 연속!';if(label)label.textContent='총 '+summary.total+'일 기록됨';}};
let praisePage=null,moderationPage=null;
const originalPraiseRender=renderPraise,originalModerationRender=renderPraiseMod;
function moreButton(root,fn){const button=document.createElement('button');button.className='search-btn';button.textContent='더 보기';button.onclick=()=>{button.disabled=true;fn().catch(e=>{button.disabled=false;alert(e.message);});};root.appendChild(button);}
window.renderPraise=function(){originalPraiseRender();if(!praisePage)return;for(const [id,key] of [['pc-received','received'],['pc-sent','sent'],['pc-unread','unread']])document.getElementById(id).textContent=praisePage.counts[key]||0;if(praisePage.hasMore)moreButton(document.getElementById('praise-list'),()=>praiseNext(praisePage.nextOffset));};
async function praiseNext(offset=0){const data=await asPromise('getPraise',[],{offset});if(offset&&praiseData){data.received=[...praiseData.received,...data.received];data.sent=[...praiseData.sent,...data.sent];}praisePage=data;praiseData=data;renderPraise();const unread=data.received.filter(p=>!p.read).slice(-50).map(p=>p.id);if(unread.length)await asPromise('markPraiseRead',[unread]);}
window.loadPraise=function(){if(!praiseData)document.getElementById('praise-list').innerHTML='<div class="no-entry">불러오는 중...</div>';praiseNext().catch(()=>{document.getElementById('praise-list').innerHTML='<div class="no-entry">칭찬함을 불러오지 못했어요</div>';});};
window.renderPraiseMod=function(){originalModerationRender();if(moderationPage?.hasMore)moreButton(document.getElementById('ds-praise-list'),()=>moderationNext(moderationPage.nextOffset));};
async function moderationNext(offset=0){const data=await asPromise('listAllPraiseForTeacher',[],{offset,filter:praiseModFilter});praiseModItems=offset?[...praiseModItems,...data.items]:data.items;moderationPage=data;renderPraiseMod();}
window.filterPraiseMod=function(el,filter){document.querySelectorAll('#ds-praise-card .dptab').forEach(t=>t.classList.remove('on'));el.classList.add('on');praiseModFilter=filter;moderationNext().catch(e=>alert(e.message));};
window.loadPraiseMod=function(){moderationNext().then(()=>_loadDashboardBundleOnly()).catch(e=>alert(e.message));};
window.doSearch=function(){const q=document.getElementById('search-input').value.trim(),generation=++searchGeneration;if(!q)return originalSearch();let entries=[];const root=document.getElementById('search-results');root.innerHTML='<div class="no-entry">불러오는 중...</div>';async function page(offset=0){const data=await asPromise('searchEntries',[q],{offset});if(generation!==searchGeneration)return;entries.push(...data.entries);const before=myEntries;myEntries=chronological(entries);try{originalSearch();}finally{myEntries=before;}document.getElementById('search-result-label').textContent='"'+q+'" 결과 '+data.total+'건';if(data.hasMore){const button=document.createElement('button');button.className='search-btn';button.dataset.okguMore='search';button.textContent='더 보기';button.onclick=()=>{button.disabled=true;page(entries.length).catch(e=>{button.disabled=false;alert(e.message);});};root.appendChild(button);}}page().catch(e=>{if(generation===searchGeneration){root.innerHTML='<div class="no-entry">검색하지 못했어요. 다시 시도해 주세요.</div>';alert(e.message);}});};
window.openStudentDiary=function(name){_modalStudentName=name;const generation=++modalGeneration;document.getElementById('modal-student-name').textContent=name+' 일기';const root=document.getElementById('modal-diary-list');root.innerHTML='<div class="no-entry">불러오는 중...</div>';document.getElementById('student-modal').classList.add('open');let entries=[];async function page(offset=0){const data=await asPromise('getStudentEntries',[api.getToken(),name],{offset});if(generation!==modalGeneration)return;const drafts=new Map([...root.querySelectorAll('input')].map(el=>[el.id,el.value]));entries.push(...data);renderModalDiaries(entries);for(const el of root.querySelectorAll('input'))if(drafts.has(el.id))el.value=drafts.get(el.id);if(data.length===50){const button=document.createElement('button');button.className='search-btn';button.dataset.okguMore='student';button.textContent='더 보기';button.onclick=()=>{button.disabled=true;page(entries.length).catch(e=>{button.disabled=false;alert(e.message);});};root.appendChild(button);}}page().catch(e=>{if(generation===modalGeneration){root.innerHTML='<div class="no-entry">일기를 불러오지 못했어요.</div>';alert(e.message);}});};
// Uploaded object references survive retries; every image must upload before save commits.
window._uploadPhotosSequentially=function(date,text,isSecret,isPublic,isMeOnly,spinner){
 const photos=[...pendingPhotos],prog=document.getElementById('photo-upload-progress'),bar=document.getElementById('photo-progress-bar'),lbl=document.getElementById('photo-progress-label');prog.style.display='block';let complete=0;
 Promise.all(photos.map(async p=>{if(p.photoRef)return p.photoRef;if(p.uploadedRef)return p.uploadedRef;p.uploadId=p.uploadId||crypto.randomUUID();const comma=p.base64.indexOf(',');const data=Uint8Array.from(atob(p.base64.slice(comma+1)),c=>c.charCodeAt(0));if(!p.thumbnail){const bitmap=await createImageBitmap(new Blob([data]));const canvas=document.createElement('canvas'),scale=Math.min(1,160/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();p.thumbnail=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('사진을 변환하지 못했어요.')),'image/jpeg',0.55));}const res=await api.upload(data,p.uploadId,p.thumbnail);p.uploadedRef=res.url;complete++;bar.style.width=Math.round(complete/photos.length*100)+'%';lbl.textContent='사진 업로드 중... ('+complete+'/'+photos.length+')';return res.url;})).then(refs=>{prog.style.display='none';_doSaveEntry(date,text,isSecret,isPublic,isMeOnly,JSON.stringify(refs),spinner);}).catch(e=>{prog.style.display='none';setSaveBusy(false);alert(e.message);});
};
const edit=editDiary;
window.editDiary=function(entry){edit(entry);window._fastEditingVersion=entry.version;curMood={emoji:entry.moodEmoji,label:entry.moodLabel,color:entry.moodColor};pendingPhotos=(entry.photos||[]).map(ref=>({id:crypto.randomUUID(),photoRef:ref,localUrl:ref}));renderPhotoPreviews();};
const cancel=cancelEditDiary;window.cancelEditDiary=function(){cancel();window._fastEditingVersion=null;};
// Six dashboard reads are now one authenticated request; feed stays paginated.
window._loadDashboardBundleOnly=function(){asPromise('getTeacherDashboardBundle',[dashPeriod,trendPeriod]).then(res=>{
 classOverview=res.overview;studentFlags=res.flags;if(praiseModFilter==='pending'){praiseModItems=res.praise;moderationPage=res.praisePage;}pushStatusItems=res.push.items;pushStatusMap=Object.fromEntries(pushStatusItems.map(p=>[p.name,!!p.enabled]));
 renderStudentList();renderCounselList();renderDashMoodBars(res.mood);renderMoodTrend(res.trend);renderPraiseMod();renderPushStatusPanel(res.push);
 const pending=res.praisePage.counts.pending||0,counsel=Object.values(studentFlags).filter(f=>f.counsel).length;
 for(const [id,count] of [['tsub-praise-badge',pending],['tsub-counsel-badge',counsel]]){const el=document.getElementById(id);if(el){el.textContent=count;el.classList.toggle('on',count>0);}}
 const badge=document.getElementById('ds-praise-pending-count');if(badge){badge.textContent=pending;badge.style.display=pending?'inline-block':'none';}
}).catch(e=>alert(e.message));};
async function allEntries(name){const entries=[];for(let offset=0;;offset+=50){const page=await asPromise('exportEntries',[name],{offset});entries.push(...page.entries);if(page.entries.length<50)break;}return entries;}
function printMessage(w,message,error=false){if(w.closed)return;const p=w.document.createElement('p');p.style.cssText='font-family:sans-serif;padding:30px;'+(error?'color:#c00;':'');p.textContent=message;w.document.body.replaceChildren(p);}
function printWindow(message){const w=window.open('','_blank');if(!w)throw new Error('팝업이 차단됐어요. 팝업 허용 후 다시 시도해주세요.');printWindows.add(w);if(message)printMessage(w,message);return w;}
async function writeYearbook(w,title,sections){for(const section of sections){for(const item of section.entries){item.photos=await Promise.all((item.photos||[]).map(ref=>imageURL(ref)));}}if(w.closed)return;w.document.open();w.document.write(_yearbookHTML(title,sections));w.document.close();const button=w.document.querySelector('.yprintbar button');button.disabled=true;await Promise.all([...w.document.images].map(img=>img.complete&&img.naturalWidth?Promise.resolve():new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('사진을 불러오지 못했어요. 다시 시도해 주세요.')),15000);img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(new Error('사진을 불러오지 못했어요.'));};})));button.disabled=false;}
window.printMyYearbook=function(){if(!currentUser){alert('로그인이 필요해요');return;}if(summary&&summary.total===0){alert('아직 작성한 일기가 없어요');return;}let w;try{w=printWindow();}catch(e){alert(e.message);return;}const name=currentUser.name;allEntries().then(entries=>{if(!entries.length){w.close();alert('아직 작성한 일기가 없어요');return;}return writeYearbook(w,name+'의 일기책',[{studentName:name,entries:chronological(entries)}]);}).catch(e=>printMessage(w,e.message,true));};
window.printClassYearbooks=function(){if(!currentUser||currentUser.role!=='선생님'){alert('선생님만 사용할 수 있어요');return;}if(!api.getToken()){alert('로그인 토큰이 없어요. 다시 로그인해주세요.');return;}let w;try{w=printWindow('📚 학급 일기책 만드는 중... 잠시만요.');}catch(e){alert(e.message);return;}asPromise('getClassOverview',[]).then(async students=>{if(!students.length){printMessage(w,'학생 목록을 불러오지 못했어요.');return;}const sections=[];for(const [i,student] of students.entries()){printMessage(w,'📚 '+student.name+' 일기 불러오는 중... ('+(i+1)+'/'+students.length+')');const entries=await allEntries(student.name);if(entries.length)sections.push({studentName:student.name,entries});}if(!sections.length){printMessage(w,'아직 작성된 일기가 없어요.');return;}await writeYearbook(w,'학급 일기책 ('+new Date().getFullYear()+')',sections);}).catch(e=>printMessage(w,'서버 오류: '+e.message,true));};
// Lazy authenticated image fetch. Tokens never appear in image URLs or HTML.
const urls=new Map(),pending=new Map();let photoEpoch=0;
async function imageURL(ref,thumb=false){if(!ref.startsWith('okgu-photo:'))return ref;const key=ref+':'+thumb;if(urls.has(key))return urls.get(key);if(pending.has(key))return pending.get(key);const epoch=photoEpoch;const promise=api.request('/api/photos/'+ref.slice(11)+(thumb?'?thumb=1':''),{headers:{Authorization:'Bearer '+api.getToken()}}).then(r=>r.blob()).then(blob=>{if(epoch!==photoEpoch)throw new Error('계정 변경');const url=URL.createObjectURL(blob);urls.set(key,url);return url;});pending.set(key,promise);try{return await promise;}finally{pending.delete(key);}}
const visible=new IntersectionObserver(items=>{for(const item of items)if(item.isIntersecting){visible.unobserve(item.target);const img=item.target;imageURL(img.dataset.okguPhoto,true).then(url=>{img.src=url;}).catch(()=>handlePhotoError(img));}});
function hydrate(root){for(const img of root.querySelectorAll('img')){const ref=img.getAttribute('src')||img.dataset.okguPhoto||'';if(ref.startsWith('okgu-photo:')){img.dataset.okguPhoto=ref;img.removeAttribute('src');visible.observe(img);}}}
new MutationObserver(mutations=>{for(const m of mutations)for(const n of m.addedNodes)if(n.nodeType===1){if(n.tagName==='IMG'){const ref=n.getAttribute('src')||n.dataset.okguPhoto;if(ref?.startsWith('okgu-photo:')){n.dataset.okguPhoto=ref;n.removeAttribute('src');visible.observe(n);}}else hydrate(n);}}).observe(document.body,{subtree:true,childList:true});
const viewer=openPhotoViewer;window.openPhotoViewer=function(ref){imageURL(ref).then(viewer).catch(e=>alert(e.message));};
window.OKGUPhotos={imageURL,clear(){photoEpoch++;for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();pending.clear();visible.disconnect();}};
const originalHandleDeepLink=handlePendingDeepLink;
window.handlePendingDeepLink=function(){if(currentUser?.role==='선생님'&&_pendingDeepLink?.open==='praise'&&!_pendingDeepLink.handled){goTo('dash','교사 대시보드','학급 현황',navButtonFor('dash'));switchTeacherSubTab('praise');finishDeepLink();return;}originalHandleDeepLink();};
const originalDeepLink=tryDeepLinkAfterRender;let deepLinkLoading=null;
window.tryDeepLinkAfterRender=function(){
 const target=_pendingDeepLink,owner=currentUser;
 if(!target||target.handled||target.open!=='diary'||!target.id||!owner)return originalDeepLink();
 const known=myEntries.find(e=>String(e.id)===String(target.id)||String(e.legacyId)===String(target.id));
 if(owner.role!=='선생님'&&known){target.id=known.id;return originalDeepLink();}
 if(owner.role==='선생님'&&document.querySelector('[data-diary-id="'+cssAttrEscape(target.id)+'"]'))return originalDeepLink();
 if(deepLinkLoading)return;
 deepLinkLoading=target;
 asPromise('getEntry',[target.id]).then(item=>{
  if(_pendingDeepLink!==target||currentUser!==owner)return;
  target.id=item.id;
  const comment=[...(item.teacherComments||[]),...(item.boardComments||[])].find(c=>c.id===target.cid||c.legacyId===target.cid);
  if(comment)target.cid=comment.id;
  if(owner.role==='선생님'){
   _modalStudentName=item.studentName;document.getElementById('modal-student-name').textContent=item.studentName+' 일기';
   document.getElementById('student-modal').classList.add('open');renderModalDiaries([item]);
   const node=(target.cid&&document.getElementById('mtc-'+target.cid))||document.querySelector('#modal-diary-list .diary-item');
   if(node)highlightTarget(node);finishDeepLink();
  }else{
   myEntries=[...myEntries.filter(e=>e.id!==item.id),item];originalDeepLink();
  }
 }).catch(e=>{if(_pendingDeepLink===target&&currentUser===owner){alert(e.message);/* retain the URL for retry after recovery/network repair */}}).finally(()=>{
  deepLinkLoading=null;
  if(_pendingDeepLink&&_pendingDeepLink!==target&&!_pendingDeepLink.handled)tryDeepLinkAfterRender();
 });
};
window.addEventListener('okgu-account-reset',()=>{viewGeneration++;modalGeneration++;searchGeneration++;summary=null;_realPushEnabled=false;_pushPromptDismissedThisSession=false;if(window._notifPoller)clearInterval(window._notifPoller);window._notifPoller=null;for(const w of printWindows)if(!w.closed)w.close();printWindows.clear();myEntries=[];pendingPhotos=[];uploadedUrls=[];editingEntryId=null;_saveInProgress=false;_quickDiarySaving=false;_praiseSending=false;_commentSendLocks={};for(const id of ['diary-text','quick-line']){const el=document.getElementById(id);if(el)el.value='';}document.getElementById('photo-preview')?.replaceChildren();boardPosts=[];praiseData=null;praisePage=null;moderationPage=null;studentList=[];classOverview=[];feedEntries=[];studentFlags={};praiseModItems=[];pushStatusItems=[];pushStatusMap={};_studentListLoaded=false;_studentListLoading=false;_boardOffset=0;_boardHasMore=false;_boardLoading=false;_feedOffset=0;_feedHasMore=false;_feedLoading=false;_feedRefreshPending=false;_feedRequestGeneration++;_teacherCommentMap={};window._fastStats=null;window._fastEditingVersion=null;document.getElementById('student-modal')?.classList.remove('open');for(const id of ['search-results','stat-entry-preview','modal-diary-list','board-list','praise-list','ds-praise-list','ds-student-list','ds-feed-list']){const el=document.getElementById(id);if(el)el.replaceChildren();}});
// Register for updates without forced activation/reload, preserving active drafts.
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).catch(()=>{});
})();
