/* Scoped, opt-in refresh. Never reload until the draft transaction commits. */
(function(){
'use strict';
const cfg=window.OKGU_CONFIG||{},base=new URL('./',location.href);
let release=null,checking=null,restoring=false,pendingFields=[],lastCheck=0,lastFeedRefresh=0;
const owner=()=>typeof currentUser!=='undefined'?currentUser?.id:null;
const busy=()=>_photoProcessing>0||_saveInProgress||_quickDiarySaving||_praiseSending||Object.values(_commentSendLocks).some(Boolean);
function fieldKey(el){
 const card=el.closest('[data-diary-id],[data-post-id]');
 const id=el.id||'';
 const stable=/^(?:ftc-input|tc-input|cinput)-\d+$/.test(id)?id.replace(/\d+$/,''):id;
 return card?(card.dataset.diaryId||card.dataset.postId)+'/'+stable:id;
}
function fields(){return [...document.querySelectorAll('textarea[id],input[id],select[id]')].filter(e=>e.id&&!/^(li-|pin-|photo-file)/.test(e.id)&&!['password','file','hidden'].includes(e.type));}
function capture(){return {format:1,owner:owner(),fields:fields().map(el=>({key:fieldKey(el),value:el.value,checked:el.checked,type:el.type})),photos:pendingPhotos,mood:curMood,quickMood,editingEntryId,version:window._fastEditingVersion,quick:document.getElementById('quick-mode-card')?.style.display==='block'};}
async function draftStore(mode,value){
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('okgu-update-drafts:'+base.pathname,1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode==='get'?'readonly':'readwrite'),s=tx.objectStore('drafts');let result;
 const req=mode==='get'?s.get(value):mode==='delete'?s.delete(value):s.put(value,value.owner);req.onsuccess=()=>{result=req.result;};
 tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('DRAFT_ABORTED'));
 });}finally{db.close();}
}
function applyFields(){
 if(!pendingFields.length)return;
 const found=new Map(fields().map(el=>[fieldKey(el),el]));
 pendingFields=pendingFields.filter(f=>{const el=found.get(f.key);if(!el)return true;if(f.type==='radio'||f.type==='checkbox')el.checked=f.checked;else el.value=f.value;return false;});
}
async function restore(){
 const id=owner();if(!id||restoring)return;restoring=true;
 try{const d=await draftStore('get',id);if(!d||d.owner!==owner()||d.format!==1)return;
 pendingFields=d.fields;pendingPhotos=d.photos;curMood=d.mood;quickMood=d.quickMood;editingEntryId=d.editingEntryId;window._fastEditingVersion=d.version;
 applyFields();renderPhotoPreviews();updateShareUI();switchWriteMode(d.quick?'quick':'full');
 if(editingEntryId){document.getElementById('edit-mode-banner').style.display='block';document.getElementById('save-btn-txt').textContent='수정 내용 저장';}
 await draftStore('delete',id);
 }catch{alert('보관한 작성 내용을 불러오지 못했어요. 이 창에서 다시 업데이트하지 말고 잠시 후 다시 로그인해 주세요.');}finally{restoring=false;}
}
function notice(){
 if(document.getElementById('okgu-update-notice'))return;
 const bar=document.createElement('div');bar.id='okgu-update-notice';bar.setAttribute('role','status');bar.style.cssText='position:fixed;bottom:12px;left:12px;right:12px;z-index:10000;background:#fff;color:#111;border:1px solid #111;padding:12px;font:14px sans-serif';
 const label=document.createElement('span');label.textContent='새 버전이 있어요. 작성 내용을 보관하고 업데이트해 주세요. ';
 const button=document.createElement('button');button.textContent='내용 보관 후 업데이트';button.onclick=async()=>{
  if(busy()){alert('진행 중인 저장이 끝난 뒤 업데이트해 주세요.');return;}
  button.disabled=true;
  try{if(owner()){const draft=capture(),before=JSON.stringify(draft);await draftStore('put',draft);if(busy()||JSON.stringify(capture())!==before)throw Error('DRAFT_CHANGED');}const u=new URL(location.href);u.searchParams.set('__okgu_release',release.version);location.replace(u.href);}
  catch{button.disabled=false;alert('작성 내용을 보관하지 못해 업데이트를 멈췄어요. 현재 글과 사진은 이 창에 남아 있어요.');}
 };
 bar.append(label,button);document.body.appendChild(bar);
}
async function check(force=false){
 if(checking)return checking;if(!force&&Date.now()-lastCheck<60000)return;
 checking=(async()=>{const u=new URL('app-release.json',base);u.searchParams.set('_',String(Date.now()));const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('RELEASE_UNAVAILABLE');const next=await r.json();if(typeof next.version!=='string'||!next.version||typeof next.apiOrigin!=='string')throw Error('RELEASE_INVALID');lastCheck=Date.now();if(next.version!==cfg.version||(next.apiOrigin&&next.apiOrigin!==cfg.apiOrigin)){release=next;notice();}})();
 try{await checking;}finally{checking=null;}
}
window.OKGUUpdate={async beforeWrite(){try{await check(true);}catch{throw Object.assign(new Error('업데이트 상태를 확인하지 못했어요. 작성 내용은 그대로 두고 연결 후 다시 저장해 주세요.'),{code:'E_UPDATE_CHECK'});}if(release)throw Object.assign(new Error('작성 내용을 보관하고 업데이트한 뒤 저장해 주세요.'),{code:'E_VERSION'});},check};
const login=_applyLoginSuccess;window._applyLoginSuccess=function(res){login(res);restore();};
new MutationObserver(applyFields).observe(document.body,{childList:true,subtree:true});
window.addEventListener('okgu-account-reset',()=>{pendingFields=[];});
function resume(){
 if(document.visibilityState==='hidden')return;check().catch(()=>{});navigator.serviceWorker?.getRegistration().then(r=>r?.update()).catch(()=>{});
 const feed=document.getElementById('feed-list');
 if(currentUser?.role==='선생님'&&document.getElementById('scr-dash')?.classList.contains('active')&&_currentTeacherSubTab==='feed'&&Date.now()-lastFeedRefresh>15000&&!_feedLoading&&!busy()&&feed&&!Array.from(feed.querySelectorAll('input,textarea')).some(el=>el.value)){
  lastFeedRefresh=Date.now();loadFeed(true);
 }
}
window.addEventListener('pageshow',resume);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
setInterval(resume,60000);resume();
})();
