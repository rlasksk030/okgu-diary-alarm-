import {hashPin} from '../worker/auth';
import {sourceFields,type Snapshot,type SourceRow} from './core';
// Export is read-only and supplied securely. Header/identity mappings must be reviewed.
export async function normalizeExport(raw:any,identity:any):Promise<Snapshot>{
 if(!raw||raw.format!=='okgu-sheet-export-v1'||!raw.complete||!identity?.reviewed||!identity.classId||!identity.sourceId)throw new Error('UNREVIEWED_EXPORT');
 const entities:Record<string,SourceRow[]>={},accountByName=new Map<string,string>();
 for(const [entity,expected] of Object.entries(sourceFields)){
  const source=raw.sheets?.[entity];if(!source){entities[entity]=[];continue;}
  if(!Array.isArray(source.headers)||!Array.isArray(source.rows))throw new Error('BAD_EXPORT');
  const columns=identity.columns?.[entity]||Object.fromEntries(expected.map(h=>[h,h]));
  if(expected.some(h=>typeof columns[h]!=='string'||source.headers.filter((x:any)=>x===columns[h]).length!==1)||source.headers.some((h:any)=>!Object.values(columns).includes(h)))throw new Error('SCHEMA_DRIFT');
  entities[entity]=[];
  for(const [index,values] of source.rows.entries()){
   if(!Array.isArray(values)||values.length!==source.headers.length)throw new Error('ROW_WIDTH_DRIFT');if(values.every((v:any)=>v===''||v===null))continue;
   const cells=Object.fromEntries(expected.map(h=>[h,values[source.headers.indexOf(columns[h])]]));
   const rowNumber=index+2;const stableIdentity=identity.rowIdentities?.[entity]?.[rowNumber];
   const id=entity==='학생계정'?stableIdentity:(cells.ID||stableIdentity);
   if(typeof id!=='string'||!id)throw new Error('STABLE_ID_REQUIRED');
   if(entity==='학생계정'){
    if(typeof cells.PIN!=='string')throw new Error('PIN_STRING_REQUIRED');
    if(!/^(sha256|scrypt)\$/.test(cells.PIN))cells.PIN=await hashPin(cells.PIN);
    if(accountByName.has(String(cells['이름'])))throw new Error('AMBIGUOUS_LOGIN_NAME');
    accountByName.set(String(cells['이름']),id);
   }
   entities[entity].push({id,cells});
  }
 }
 const fields:Record<string,string[]>={'일기기록':['학생이름'],'게시판':['작성자'],'게시판댓글':['작성자'],'게시판좋아요':['학생이름'],'칭찬메시지':['보낸사람','받는사람'],'선생님댓글':['선생님이름'],'학생태그':['이름','설정자'],'알림':['받는사람'],'푸시구독':['이름']};
 for(const [entity,rows] of Object.entries(entities))for(const row of rows){row.accountRefs={};for(const field of fields[entity]||[]){const ref=accountByName.get(String(row.cells[field]));if(!ref)throw new Error('UNRESOLVED_ACCOUNT');row.accountRefs[field]=ref;}}
 const files=raw.files||[];
 for(const row of entities['일기기록']||[]){let urls;try{urls=JSON.parse(String(row.cells['사진URLs']));}catch{throw new Error('PHOTO_JSON');}if(!Array.isArray(urls))throw new Error('PHOTO_JSON');row.cells['사진URLs']=JSON.stringify(urls.map((url:any,ordinal:number)=>{const file=files.find((f:any)=>f.diaryId===row.id&&f.ordinal===ordinal&&f.sourceUrl===url);if(!file)throw new Error('PHOTO_MANIFEST_REQUIRED');return file.id;}));}
 return {format:1,sourceId:identity.sourceId,synthetic:raw.synthetic===true,complete:true,capturedAt:raw.capturedAt,classId:identity.classId,classLabel:identity.classLabel,identityReviewed:true,entities,files:files.map(({sourceUrl,...f}:any)=>f)};
}
