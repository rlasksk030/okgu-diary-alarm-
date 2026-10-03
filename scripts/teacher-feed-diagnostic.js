/* Paste in the existing operating teacher app's Chrome Sources > Snippets. Read requests only.
   Downloads metadata locally; sends nothing to a diagnostic server.
   No PIN, token, account name, diary ID/body, photo URL, or endpoint is exported. */
(async function(){
 'use strict';
 if(location.origin!=='https://rlasksk030.github.io'||location.pathname!=='/okgu-diary-alarm-/'||typeof currentUser==='undefined'||currentUser?.role!=='선생님'||typeof _getToken!=='function')throw Error('기존 옥구 앱에서 선생님으로 로그인한 뒤 실행해 주세요.');
 const owner=currentUser,token=_getToken(),report={format:'okgu-teacher-feed-diagnostic-v1',checkedAt:new Date().toISOString(),source:'operating teacher browser',writesRequested:false,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,screen:{tab:typeof feedTab==='string'?feedTab:null,loading:typeof _feedLoading==='boolean'?_feedLoading:null,offset:typeof _feedOffset==='number'?_feedOffset:null,loadedCount:typeof feedEntries!=='undefined'&&Array.isArray(feedEntries)?feedEntries.length:null,renderedCards:document.querySelectorAll('#feed-list [data-diary-id]').length,errorVisible:/불러오지 못/.test(document.getElementById('feed-list')?.textContent||'')},requests:[]};
 function category(e){const message=String(e?.message||'');return /getRecentEntries is not defined/.test(message)?'FEED_METHOD_NOT_DEFINED':/timeout/i.test(message)?'TIMEOUT':/network/i.test(message)?'NETWORK':/authorization|permission|권한|승인/i.test(message)?'GOOGLE_AUTHORIZATION':/quota|too many|할당|횟수/i.test(message)?'GOOGLE_QUOTA':/serializ|Date object/i.test(message)?'SERIALIZATION':/range|column|열|범위/i.test(message)?'SHEET_RANGE':e?.code==='E_AUTH'?'E_AUTH':'UNCLASSIFIED_SERVER_ERROR';}
 function call(method,args){return new Promise(resolve=>{const started=performance.now();google.script.run.withSuccessHandler(value=>{report.requests.push({method,ms:Math.round(performance.now()-started),success:true,resultKind:Array.isArray(value)?'array':value===null?'null':typeof value,resultCode:['E_AUTH','E_UNKNOWN'].includes(value?.code)?value.code:null});resolve(value);}).withFailureHandler(e=>{report.requests.push({method,ms:Math.round(performance.now()-started),success:false,errorCategory:category(e)});resolve(null);})[method](...args);});}
 const auth=await call('verifyToken',[token]);report.teacherSessionValid=!!auth?.success&&auth.role==='선생님';
 if(report.teacherSessionValid&&owner===currentUser&&token===_getToken()){
  const value=await call('getRecentEntries',[token,13,0]),rows=Array.isArray(value)?value:Array.isArray(value?.entries)?value.entries:null;
  report.feed={recognizedShape:rows!==null,entryCount:rows?.length??null,emptySuccess:rows?.length===0,hasMore:typeof value?.hasMore==='boolean'?value.hasMore:null};
  if(rows){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());report.feed.canonicalDateCount=rows.filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(String(e.date||''))).length;report.feed.kstTodayCount=rows.filter(e=>String(e.date||'').split('T')[0]===day).length;report.feed.missingIdCount=rows.filter(e=>!e.id).length;report.feed.dateFieldTypes=[...new Set(rows.map(e=>typeof e.date))];}
 }
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='okgu-teacher-feed-diagnostic.private.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 console.info('피드 진단 파일을 다운로드했습니다. 이 대화에 파일로 첨부하세요. 이름·본문·PIN·토큰은 포함하지 않습니다.');
})();
