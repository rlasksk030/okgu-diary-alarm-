/* Compatibility calls use the new authenticated API; there is no GAS/JSONP fallback. */
(function(){
'use strict';
const cfg=window.OKGU_CONFIG||{};
const reads=new Set(['verifyToken','getStudents','getMyEntries','getStudentDashboard','getBoard','getPraise','getRecentEntries','getClassOverview','getClassMoodStats','getStudentEntries','getNotifications','listAllPraiseForTeacher','listStudentFlags','getMoodTrend','exportMoodStatsCsv','getMyPushStatus','getPushSubscriptionStatus','getTeacherDashboardBundle','searchEntries','getMyStats','getEntry','exportEntries']);
let epoch=0;const inflight=new Map(),attempts=new Map(),versions=new Map(),controllers=new Set();
const getToken=()=>sessionStorage.getItem('okgu_fast_token')||localStorage.getItem('okgu_fast_token')||'';
function reset(){epoch++;for(const c of controllers)c.abort();controllers.clear();inflight.clear();attempts.clear();versions.clear();if(window.OKGUPhotos)window.OKGUPhotos.clear();window.dispatchEvent(new Event('okgu-account-reset'));}
function record(value){if(Array.isArray(value)){value.forEach(record);return;}if(value&&typeof value==='object'){if(value.id&&Number.isInteger(value.version))versions.set(value.id,value.version);Object.values(value).forEach(record);}}
async function request(path,options){if(!cfg.apiOrigin)throw new Error('시험 API 주소를 설정해 주세요.');const ctl=new AbortController();controllers.add(ctl);const timer=setTimeout(()=>ctl.abort(),30000);try{const r=await fetch(cfg.apiOrigin+path,{...options,signal:ctl.signal,cache:'no-store'});if(!r.ok){let err;try{err=await r.json();}catch{}throw Object.assign(new Error(err?.msg||'연결을 확인한 뒤 다시 시도해 주세요.'),{code:err?.code,status:r.status});}return r;}finally{clearTimeout(timer);controllers.delete(ctl);}}
async function call(method,args,extra={}){
 if(method==='login')reset();
 const generation=epoch,token=getToken();
 const body={method,args,...extra};
 if(method==='saveEntry'&&args[10])body.expectedVersion=extra.expectedVersion??window._fastEditingVersion??versions.get(args[10]);
 if(method==='deleteEntry'||method==='deleteEntryAsTeacher')body.expectedVersion=extra.expectedVersion??versions.get(args[1]);
 const key=JSON.stringify({method,args,extra,expectedVersion:body.expectedVersion,token});
 if(!reads.has(method)&&!['login','logout','changePin'].includes(method))body.requestId=attempts.get(key)||crypto.randomUUID();
 if(body.requestId)attempts.set(key,body.requestId);
 if(inflight.has(key))return inflight.get(key);
 const promise=(async()=>{const r=await request('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json','X-OKGU-Request':'1',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const value=await r.json();if(generation!==epoch)throw new Error('계정이 변경되어 요청을 취소했어요.');record(value);attempts.delete(key);
 if(method==='login'){sessionStorage.removeItem('okgu_fast_token');localStorage.removeItem('okgu_fast_token');(args[2]?localStorage:sessionStorage).setItem('okgu_fast_token',value.token);}
 if(method==='logout'){sessionStorage.removeItem('okgu_fast_token');localStorage.removeItem('okgu_fast_token');reset();}
 return value;})();inflight.set(key,promise);try{return await promise;}finally{if(inflight.get(key)===promise)inflight.delete(key);}
}
function runner(){let success=null,failure=null;let proxy;proxy=new Proxy({},{get(_t,prop){if(prop==='withSuccessHandler')return fn=>{success=fn;return proxy;};if(prop==='withFailureHandler')return fn=>{failure=fn;return proxy;};return (...args)=>{call(String(prop),args).then(v=>{if(success)success(v);}).catch(e=>{if(failure)failure(e);else console.error(e.code||e.message);});};}});return proxy;}
window.google={script:{}};Object.defineProperty(window.google.script,'run',{get:runner});
window.OKGUAPI={call,getToken,reset,versions,request,async upload(bytes,id,thumbnail){let body=bytes;const headers={Authorization:'Bearer '+getToken(),'X-Request-Id':id};if(thumbnail){body=new FormData();body.append('photo',new Blob([bytes]),'photo');body.append('thumbnail',thumbnail,'thumbnail');}else headers['Content-Type']='application/octet-stream';const r=await request('/api/photos',{method:'POST',headers,body});return r.json();}};
})();
