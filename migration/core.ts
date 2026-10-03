import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
export const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
export function stableId(source:string,entity:string,id:string) {const h=sha(JSON.stringify([source,entity,id]));return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
export type SourceRow={id:string;cells:Record<string,unknown>;accountRefs?:Record<string,string>};
export type Snapshot={format:1;sourceId:string;synthetic:boolean;complete:boolean;capturedAt:string;classId:string;classLabel:string;identityReviewed:boolean;teacherBlankClassIds?:string[];sourceDispositions?:{entity:string;id:string;hash:string;reason:'missing-source-parent'|'source-flags-without-record'|'duplicate-source-like'}[];entities:Record<string,SourceRow[]>;files:{id:string;diaryId:string;ordinal:number;path:string;sha256:string;size:number;mime:string}[]};
export const sourceFields:Record<string,string[]>={
 '학생계정':['이름','PIN','역할','반'], '일기기록':['ID','날짜','학생이름','기분이모지','기분라벨','기분색상','일기내용','비밀여부','공개여부','나만보기','저장시간','사진URLs'],
 '게시판':['ID','작성자','내용','기분','날짜표시','좋아요수','작성시간'], '게시판댓글':['ID','게시글ID','작성자','내용','작성시간','부모댓글ID'], '게시판좋아요':['게시글ID','학생이름'],
 '칭찬메시지':['ID','보낸사람','받는사람','메시지','작성시간','읽음여부','익명여부','숨김여부','승인상태'], '선생님댓글':['ID','일기ID','선생님이름','댓글내용','작성시간','역할','부모댓글ID'],
 '학생태그':['이름','상담필요','메모','설정자','설정시간'], '알림':['ID','받는사람','유형','제목','내용','링크ID','생성시간','읽음여부'], '푸시구독':['이름','역할','Endpoint','SubscriptionJSON','등록시간','활성']
};
const tableByEntity:Record<string,string>={'학생계정':'accounts','일기기록':'diaries','게시판':'board_posts','게시판댓글':'board_comments','게시판좋아요':'board_likes','칭찬메시지':'praises','선생님댓글':'diary_comments','학생태그':'teacher_notes'};
export type Issue={entity:string;idHash:string;code:string};
const flag=(value:unknown)=>{if(value===true||value==='TRUE')return true;if(value===false||value==='FALSE'||value==='')return false;throw new Error('AMBIGUOUS_BOOLEAN');};
export function sourcePushSubscription(c:Record<string,unknown>){
 if(![true,false,'TRUE','FALSE','true','false',''].includes(c['활성'] as any))throw new Error('AMBIGUOUS_PUSH_ENABLED');
 const enabled=c['활성']===true||c['활성']==='TRUE'||c['활성']==='true';
 try{const sub=JSON.parse(String(c.SubscriptionJSON)),url=new URL(sub.endpoint);
  if(c.Endpoint!==sub.endpoint||url.protocol!=='https:'||url.username||url.password||!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname)||!sub.keys?.p256dh||!sub.keys?.auth||JSON.stringify(sub).length>4096)throw new Error('invalid');
  return {sub,enabled};
 }catch{if(enabled)throw new Error('INVALID_PUSH_SUBSCRIPTION');return null;}
}
export function visibility(c:Record<string,unknown>){const me=flag(c['나만보기']),secret=flag(c['비밀여부']),pub=flag(c['공개여부']);return me?'private':secret?'teacher':pub?'class':'teacher';}
function iso(v:unknown){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v)))throw new Error('AMBIGUOUS_TIMESTAMP');return v;}
function day(v:unknown){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw new Error('AMBIGUOUS_DATE');return v;}
export function plan(snapshot:Snapshot){
 const issues:Issue[]=[],records:{entity:string;row:SourceRow;targetId:string;hash:string;archiveOnly?:boolean}[]=[];
 const issue=(entity:string,id:string,code:string)=>issues.push({entity,idHash:sha(id),code});
 if(snapshot.format!==1||!snapshot.complete||!snapshot.identityReviewed)issue('snapshot','root','INCOMPLETE_OR_UNREVIEWED');
 if(!snapshot.sourceId||!Number.isFinite(Date.parse(snapshot.capturedAt)))issue('snapshot','root','SOURCE_METADATA');
 const accounts=new Map((snapshot.entities['학생계정']||[]).map(r=>[r.id,r]));
 const names=new Set<string>();
 const endpoints=new Set<string>();
 let archivedDisabledPush=false;
 for(const [entity,rows] of Object.entries(snapshot.entities)) {
  const seen=new Set<string>();
  for(const row of rows){
   if(!row.id||seen.has(row.id))issue(entity,row.id||'missing','MISSING_OR_DUPLICATE_ID');seen.add(row.id);
   if(!sourceFields[entity])issue(entity,row.id,'UNKNOWN_ENTITY');
   const expected=sourceFields[entity]||[];
   if(Object.keys(row.cells).some(k=>!expected.includes(k))||expected.some(k=>!(k in row.cells)))issue(entity,row.id,'SCHEMA_DRIFT');
   const disposition=snapshot.sourceDispositions?.find(d=>d.entity===entity&&d.id===row.id);
   let archiveOnly=false;
   if(disposition){const c=row.cells,orphan=entity==='선생님댓글'?!snapshot.entities['일기기록']?.some(r=>r.id===c['일기ID']):['게시판댓글','게시판좋아요'].includes(entity)?!snapshot.entities['게시판']?.some(r=>r.id===c['게시글ID']):false;
    const flagsOnly=entity==='칭찬메시지'&&['ID','보낸사람','받는사람','메시지','작성시간','읽음여부','익명여부'].every(k=>c[k]===''||c[k]===null);
    const duplicateLike=entity==='게시판좋아요'&&records.some(r=>r.entity===entity&&JSON.stringify(r.row.cells)===JSON.stringify(row.cells)&&JSON.stringify(r.row.accountRefs)===JSON.stringify(row.accountRefs));
    archiveOnly=disposition.hash===sha(JSON.stringify(row))&&(disposition.reason==='missing-source-parent'?orphan:disposition.reason==='duplicate-source-like'?duplicateLike:flagsOnly);
    if(!archiveOnly)issue(entity,row.id,'INVALID_SOURCE_DISPOSITION');
   }
   if(archiveOnly&&disposition?.reason==='source-flags-without-record'){records.push({entity,row,targetId:stableId(snapshot.sourceId,entity,row.id),hash:sha(JSON.stringify(row)),archiveOnly});continue;}
   try{
    for(const field of ({'일기기록':['학생이름'],'게시판':['작성자'],'게시판댓글':['작성자'],'게시판좋아요':['학생이름'],'칭찬메시지':['보낸사람','받는사람'],'선생님댓글':['선생님이름'],'학생태그':['이름','설정자'],'알림':['받는사람'],'푸시구독':['이름']} as Record<string,string[]>)[entity]||[]){
     const ref=row.accountRefs?.[field],account=ref?accounts.get(ref):undefined;
     if(!(entity==='칭찬메시지'&&field==='받는사람'&&ref==='@homeroom'&&row.cells[field]==='담임')&&(!account||account.cells['이름']!==row.cells[field]))throw new Error('UNRESOLVED_ACCOUNT');
    }
    if(entity==='학생계정'){
     const c=row.cells; if(typeof c.PIN!=='string'||!(/^(?:sha256\$[^$]+\$[^$]+|pbkdf2\$600000\$[a-f0-9]{32}\$[a-f0-9]{64})$/.test(c.PIN)))throw new Error('UNSUPPORTED_PIN');
     if(!['학생','선생님'].includes(String(c['역할'])))throw new Error('UNKNOWN_ROLE');
     if(c['반']!==snapshot.classLabel&&!(c['반']===''&&c['역할']==='선생님'&&snapshot.teacherBlankClassIds?.includes(row.id)))throw new Error('CLASS_MISMATCH');
     const name=String(c['이름']);if(names.has(name))throw new Error('AMBIGUOUS_LOGIN_NAME');names.add(name);
    }
    if(entity==='일기기록') {day(row.cells['날짜']);iso(row.cells['저장시간']);visibility(row.cells);
     const photos=JSON.parse(String(row.cells['사진URLs']));if(!Array.isArray(photos))throw new Error('PHOTO_JSON');
     const files=snapshot.files.filter(f=>f.diaryId===row.id).sort((a,b)=>a.ordinal-b.ordinal);
     if(photos.length!==files.length||files.some((f,i)=>f.ordinal!==i||photos[i]!==f.id))throw new Error('PHOTO_MANIFEST_MISMATCH');
    }
    if(entity==='칭찬메시지' && !['','pending','approved','rejected'].includes(String(row.cells['승인상태'])))throw new Error('UNKNOWN_PRAISE_STATUS');
    if(entity==='푸시구독'){
     const c=row.cells,parsed=sourcePushSubscription(c),account=accounts.get(row.accountRefs?.['이름']||'');
     if(c['역할']!==account?.cells['역할'])throw new Error('PUSH_OWNER_ROLE_MISMATCH');
     if(parsed){if(endpoints.has(parsed.sub.endpoint))throw new Error('DUPLICATE_PUSH_ENDPOINT');endpoints.add(parsed.sub.endpoint);}else archivedDisabledPush=true;
    }
    for(const field of ['작성시간','설정시간','생성시간','등록시간']) if(field in row.cells)iso(row.cells[field]);
   }catch(e){issue(entity,row.id,(e as Error).message);}
   records.push({entity,row,targetId:stableId(snapshot.sourceId,entity,row.id),hash:sha(JSON.stringify(row)),...(archiveOnly?{archiveOnly:true}:{})});
  }
 }
 const exists=(entity:string,id:unknown)=>(snapshot.entities[entity]||[]).some(r=>r.id===id);
 for(const r of records){
  const c=r.row.cells;
  if('일기ID' in c&&!exists('일기기록',c['일기ID'])&&!r.archiveOnly)issue(r.entity,r.row.id,'BROKEN_DIARY_REFERENCE');
  if('게시글ID' in c&&!exists('게시판',c['게시글ID'])&&!r.archiveOnly)issue(r.entity,r.row.id,'BROKEN_POST_REFERENCE');
  if(c['부모댓글ID']&&!exists(r.entity,c['부모댓글ID']))issue(r.entity,r.row.id,'BROKEN_PARENT_REFERENCE');
  if(c['부모댓글ID']){const parent=snapshot.entities[r.entity].find(p=>p.id===c['부모댓글ID']);const field=r.entity==='선생님댓글'?'일기ID':'게시글ID';if(parent?.cells[field]!==c[field]||c['부모댓글ID']===r.row.id)issue(r.entity,r.row.id,'CROSS_PARENT_REFERENCE');}
 }
 for(const entity of ['게시판댓글','선생님댓글']) {
  const parents=new Map((snapshot.entities[entity]||[]).map(r=>[r.id,String(r.cells['부모댓글ID']||'')]));
  for(const [id] of parents){const seen=new Set<string>();let current=id;while(current){if(seen.has(current)){issue(entity,id,'CYCLIC_PARENT_REFERENCE');break;}seen.add(current);current=parents.get(current)||'';}}
 }
 const fileKeys=new Set<string>();for(const f of snapshot.files){const key=f.diaryId+':'+f.ordinal;if(!exists('일기기록',f.diaryId)||fileKeys.has(key)||!Number.isInteger(f.ordinal)||f.ordinal<0)issue('photos',f.id,'BROKEN_PHOTO_REFERENCE');fileKeys.add(key);}
 return {records,issues,counts:Object.fromEntries(Object.entries(snapshot.entities).map(([k,v])=>[k,v.length])),archiveOnly:[...((snapshot.entities['알림']||[]).length?['알림']:[]),...(archivedDisabledPush?['푸시구독']:[])]};
}
