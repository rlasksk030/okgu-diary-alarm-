/* Existing DOM/CSS and UI renderers remain; only data and service handling change. */
(function(){
'use strict';
const api=window.OKGUAPI;
const originalSearch=doSearch,originalPrint=printMyYearbook,originalClassPrint=printClassYearbooks;
let summary=null,searchGeneration=0;
const asPromise=(method,args,extra)=>api.call(method,args,extra);
window._getToken=api.getToken;
window.tryAutoLogin=function(){const token=api.getToken();if(!token)return;showLoading(true);asPromise('verifyToken',[token]).then(res=>_applyLoginSuccess({...res,token})).catch(e=>{if(e.code==='E_AUTH'){sessionStorage.removeItem('okgu_fast_token');localStorage.removeItem('okgu_fast_token');}document.getElementById('login-screen').style.display='block';}).finally(()=>showLoading(false));};
window.doLogout=function(){closeAvMenu();customConfirm('로그아웃할까요?',function(){asPromise('logout',[]).then(()=>location.reload()).catch(e=>alert(e.message));});};
window._handleAuthErr=function(res){if(res&&res.code==='E_AUTH'){alert('로그인이 만료되었어요. 작성한 내용은 보관한 뒤 다시 로그인해 주세요.');return true;}return false;};
function applyData(data){myEntries=data.entries||[];_teacherCommentMap=data.teacherCommentMap||{};summary=data.allStats||data.stats;window._fastStats=data.stats;}
window.loadMyEntries=function(cb){asPromise('getStudentDashboard',[api.getToken(),currentUser.name],{period:'month'}).then(data=>{applyData(data);renderStreak();if(cb)cb();}).catch(e=>{console.error(e.code||e.message);if(cb)cb();});};
window.loadAndRenderStat=function(cb){asPromise('getStudentDashboard',[api.getToken(),currentUser.name],{period:curStatPeriod}).then(data=>{applyData(data);renderStreakStat();renderStat(curStatPeriod);if(cb)cb();tryDeepLinkAfterRender();}).catch(e=>{alert(e.message);if(cb)cb();});};
window.switchStat=function(el,period){document.querySelectorAll('.stab').forEach(t=>t.classList.remove('on'));el.classList.add('on');curStatPeriod=period;loadAndRenderStat();};
const streak=renderStreak,streakStat=renderStreakStat;
window.renderStreak=function(){streak();const el=document.querySelector('#streak-area .streak-days');if(el&&summary)el.textContent=summary.streak+'일 연속!';};
window.renderStreakStat=function(){streakStat();if(summary&&summary.streak){const root=document.getElementById('streak-stat-area');const days=root.querySelector('.streak-days'),label=root.querySelector('.streak-label');if(days)days.textContent='🔥 '+summary.streak+'일 연속!';if(label)label.textContent='총 '+summary.totalDays+'일 기록됨';}};
window.doSearch=function(){const q=document.getElementById('search-input').value.trim(),generation=++searchGeneration;if(!q)return originalSearch();asPromise('searchEntries',[q]).then(data=>{if(generation!==searchGeneration)return;const before=myEntries;myEntries=data.entries;try{originalSearch();}finally{myEntries=before;}}).catch(e=>alert(e.message));};
// Uploaded object references survive retries; every image must upload before save commits.
window._uploadPhotosSequentially=function(date,text,isSecret,isPublic,isMeOnly,spinner){
 const photos=[...pendingPhotos],prog=document.getElementById('photo-upload-progress'),bar=document.getElementById('photo-progress-bar'),lbl=document.getElementById('photo-progress-label');prog.style.display='block';let complete=0;
 Promise.all(photos.map(async p=>{if(p.photoRef)return p.photoRef;if(p.uploadedRef)return p.uploadedRef;p.uploadId=p.uploadId||crypto.randomUUID();const comma=p.base64.indexOf(',');const data=Uint8Array.from(atob(p.base64.slice(comma+1)),c=>c.charCodeAt(0));const res=await api.upload(data,p.uploadId);p.uploadedRef=res.url;complete++;bar.style.width=Math.round(complete/photos.length*100)+'%';lbl.textContent='사진 업로드 중... ('+complete+'/'+photos.length+')';return res.url;})).then(refs=>{prog.style.display='none';_doSaveEntry(date,text,isSecret,isPublic,isMeOnly,JSON.stringify(refs),spinner);}).catch(e=>{prog.style.display='none';setSaveBusy(false);alert(e.message);});
};
const edit=editDiary;
window.editDiary=function(entry){edit(entry);window._fastEditingVersion=entry.version;curMood={emoji:entry.moodEmoji,label:entry.moodLabel,color:entry.moodColor};pendingPhotos=(entry.photos||[]).map(ref=>({id:crypto.randomUUID(),photoRef:ref,localUrl:ref}));renderPhotoPreviews();};
const cancel=cancelEditDiary;window.cancelEditDiary=function(){cancel();window._fastEditingVersion=null;};
// Six dashboard reads are now one authenticated request; feed stays paginated.
window._loadDashboardBundleOnly=function(){asPromise('getTeacherDashboardBundle',[dashPeriod,trendPeriod]).then(res=>{
 classOverview=res.overview;studentFlags=res.flags;praiseModItems=res.praise;pushStatusItems=res.push.items;pushStatusMap=Object.fromEntries(pushStatusItems.map(p=>[p.name,!!p.enabled]));
 renderStudentList();renderCounselList();renderDashMoodBars(res.mood);renderMoodTrend(res.trend);renderPraiseMod();renderPushStatusPanel(res.push);
 const pending=praiseModItems.filter(p=>p.status==='pending').length,counsel=Object.values(studentFlags).filter(f=>f.counsel).length;
 for(const [id,count] of [['tsub-praise-badge',pending],['tsub-counsel-badge',counsel],['ds-praise-pending-count',pending]]){const el=document.getElementById(id);if(el){el.textContent=count;el.classList.toggle('on',count>0);el.style.display=count?'inline-block':'none';}}
}).catch(e=>alert(e.message));};
async function allEntries(name){const entries=[];for(let offset=0;;offset+=50){const page=await asPromise('exportEntries',[name],{offset});entries.push(...page.entries);if(page.entries.length<50)break;}return entries;}
window.printMyYearbook=async function(){if(!currentUser)return;try{const all=await allEntries();const old=myEntries;myEntries=all;try{originalPrint();}finally{myEntries=old;}}catch(e){alert(e.message);}};
window.printClassYearbooks=function(){if(!currentUser||currentUser.role!=='선생님')return;const w=window.open('','_blank');if(!w){alert('팝업을 허용해 주세요.');return;}w.document.write('<p>학급 일기책 만드는 중...</p>');asPromise('getClassOverview',[]).then(async students=>{const sections=[];for(const s of students)sections.push({studentName:s.name,entries:await allEntries(s.name)});w.document.open();w.document.write(_yearbookHTML('학급 일기책 ('+new Date().getFullYear()+')',sections));w.document.close();}).catch(e=>{w.document.body.textContent=e.message;});};
// Lazy authenticated image fetch. Tokens never appear in image URLs or HTML.
const urls=new Map(),pending=new Map();let photoEpoch=0;
async function imageURL(ref,thumb=false){if(!ref.startsWith('okgu-photo:'))return ref;const key=ref+':'+thumb;if(urls.has(key))return urls.get(key);if(pending.has(key))return pending.get(key);const epoch=photoEpoch;const promise=api.request('/api/photos/'+ref.slice(11)+(thumb?'?thumb=1':''),{headers:{Authorization:'Bearer '+api.getToken()}}).then(r=>r.blob()).then(blob=>{if(epoch!==photoEpoch)throw new Error('계정 변경');const url=URL.createObjectURL(blob);urls.set(key,url);return url;});pending.set(key,promise);try{return await promise;}finally{pending.delete(key);}}
const visible=new IntersectionObserver(items=>{for(const item of items)if(item.isIntersecting){visible.unobserve(item.target);const img=item.target;imageURL(img.dataset.okguPhoto,true).then(url=>{img.src=url;}).catch(()=>handlePhotoError(img));}});
function hydrate(root){for(const img of root.querySelectorAll('img')){const ref=img.getAttribute('src')||img.dataset.okguPhoto||'';if(ref.startsWith('okgu-photo:')){img.dataset.okguPhoto=ref;img.removeAttribute('src');visible.observe(img);}}}
new MutationObserver(mutations=>{for(const m of mutations)for(const n of m.addedNodes)if(n.nodeType===1){if(n.tagName==='IMG'){const ref=n.getAttribute('src')||n.dataset.okguPhoto;if(ref?.startsWith('okgu-photo:')){n.dataset.okguPhoto=ref;n.removeAttribute('src');visible.observe(n);}}else hydrate(n);}}).observe(document.body,{subtree:true,childList:true});
const viewer=openPhotoViewer;window.openPhotoViewer=function(ref){imageURL(ref).then(viewer).catch(e=>alert(e.message));};
window.OKGUPhotos={imageURL,clear(){photoEpoch++;for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();pending.clear();visible.disconnect();}};
// Register for updates without forced activation/reload, preserving active drafts.
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js?v=fast-20261002').catch(()=>{});
})();
