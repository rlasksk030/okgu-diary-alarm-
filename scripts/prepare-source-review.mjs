// Private offline positional mapping rehearsal. Production import is blocked until
// the owner confirms the CURRENT deployment matches the previously supplied Code.gs.
import {readFile,writeFile,mkdir,readdir,realpath} from 'node:fs/promises';
import path from 'node:path';import {sourceFields,sha,stableId,plan} from '../migration/core.ts';
try{
 const local=await realpath('.local'),input=await realpath(process.argv[2]);if(!input.startsWith(local+path.sep))throw Error('PRIVATE_INPUT_REQUIRED');
 const original=await readFile(input),raw=JSON.parse(original);if(!['okgu-sheet-raw-export-v1','okgu-sheet-raw-export-v2'].includes(raw.format)||!raw.complete||raw.timeZone!=='Asia/Seoul')throw Error('COMPLETE_KST_SOURCE_REQUIRED');
 const sourceId='sheet:'+sha(String(raw.provenance?.sourceSpreadsheetId||''));if(!raw.provenance?.sourceSpreadsheetId)throw Error('SOURCE_ID_REQUIRED');
 const privateServer=process.argv[3];if(!privateServer)throw Error('PREVIOUSLY_SUPPLIED_CODE_REQUIRED');const codeHash=sha(await readFile(privateServer));if(codeHash!=='44fab4356facf2e79466b0d4b530ea9422a1247c6e7d98e8e70fa1b80f7a3e2f')throw Error('SOURCE_CODE_POSITIONAL_ADAPTER_MISMATCH');
 let reviewed=false;if(process.argv[4]){const reviewPath=await realpath(process.argv[4]);if(!reviewPath.startsWith(local+path.sep))throw Error('PRIVATE_REVIEW_REQUIRED');const review=JSON.parse(await readFile(reviewPath));if(review.currentDeploymentMatchesSuppliedCode!==true||review.suppliedCodeSha256!==codeHash||review.rawSha256!==sha(original))throw Error('CURRENT_DEPLOYMENT_REVIEW_MISMATCH');reviewed=true;}
 const entities={},names=new Map(),teacherBlankClassIds=[],sourceDispositions=[],likeOccurrences=new Map();
 for(const [entity,source] of Object.entries(raw.sheets)){
  const headers=sourceFields[entity];if(!headers||source.headers.length!==headers.length)throw Error('UNKNOWN_SCHEMA_REQUIRES_REVIEW');entities[entity]=[];
  for(const values of source.rows){if(values.every(v=>v===''||v===null))continue;if(values.length!==headers.length)throw Error('SOURCE_ROW_WIDTH');
   const cells=Object.fromEntries(headers.map((h,i)=>{let v=values[i];if(v&&typeof v==='object'){if(v.type!=='date'||!Number.isFinite(Date.parse(v.iso)))throw Error('SOURCE_TYPE_REVIEW');v=h==='날짜'?new Intl.DateTimeFormat('en-CA',{timeZone:raw.timeZone}).format(new Date(v.iso)):new Date(v.iso).toISOString();}return [h,v];}));
   let id;if(entity==='학생계정'){id='account:'+sha(String(cells['이름']));names.set(String(cells['이름']),id);if(cells['역할']==='선생님'&&cells['반']==='')teacherBlankClassIds.push(id);}
   else if(cells.ID)id=String(cells.ID);
   else if(entity==='게시판좋아요'){const key=sha(JSON.stringify([cells['게시글ID'],cells['학생이름']])),n=likeOccurrences.get(key)||0;likeOccurrences.set(key,n+1);id='like:'+key+':'+n;}
   else if(entity==='푸시구독')id='subscription:'+sha(String(cells.Endpoint));
   else if(entity==='학생태그')id='note:'+sha(String(cells['이름']));
   else id='source-row:'+sha(JSON.stringify(cells));
   entities[entity].push({id,cells});
  }
 }
 const students=(entities['학생계정']||[]).filter(r=>r.cells['역할']==='학생');const classes=new Set(students.map(r=>r.cells['반']));if(classes.size!==1||!students.length)throw Error('SINGLE_SOURCE_ROSTER_REVIEW_REQUIRED');
 const classLabel=[...classes][0],fields={'일기기록':['학생이름'],'게시판':['작성자'],'게시판댓글':['작성자'],'게시판좋아요':['학생이름'],'칭찬메시지':['보낸사람','받는사람'],'선생님댓글':['선생님이름'],'학생태그':['이름','설정자'],'알림':['받는사람'],'푸시구독':['이름']};
 for(const [entity,rows] of Object.entries(entities))for(const row of rows){
  row.accountRefs={};for(const field of fields[entity]||[]){const value=row.cells[field];const ref=entity==='칭찬메시지'&&field==='받는사람'&&value==='담임'?'@homeroom':names.get(String(value));if(ref)row.accountRefs[field]=ref;}
 }
 const parentExists=(entity,id)=>(entities[entity]||[]).some(r=>r.id===id);
 const seenLikes=new Set();for(const [entity,rows] of Object.entries(entities))for(const row of rows){const c=row.cells;
  const orphan=entity==='선생님댓글'?!parentExists('일기기록',c['일기ID']):['게시판댓글','게시판좋아요'].includes(entity)?!parentExists('게시판',c['게시글ID']):false;
  const flagsOnly=entity==='칭찬메시지'&&['ID','보낸사람','받는사람','메시지','작성시간','읽음여부','익명여부'].every(k=>c[k]===''||c[k]===null);
  const likeKey=JSON.stringify(c),duplicateLike=entity==='게시판좋아요'&&seenLikes.has(likeKey);if(entity==='게시판좋아요')seenLikes.add(likeKey);
  if(orphan||flagsOnly||duplicateLike)sourceDispositions.push({entity,id:row.id,hash:sha(JSON.stringify(row)),reason:orphan?'missing-source-parent':duplicateLike?'duplicate-source-like':'source-flags-without-record'});
 }
 let inputFiles=raw.files;
 if(raw.format.endsWith('v2'))inputFiles=raw.photoReferences.map(r=>{if(r.sheet!=='일기기록'||r.column!==12)throw Error('PHOTO_POSITION_REVIEW_REQUIRED');const row=raw.sheets[r.sheet].rows[r.row-2],photo=raw.photos.find(p=>p.id===r.id);if(!row||!photo)throw Error('PHOTO_REFERENCE_MISSING');return {...photo,diaryId:String(row[0]),ordinal:r.ordinal,sourceUrl:r.sourceUrl};});
 const root=path.dirname(input),paths=[];async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const full=path.join(folder,entry.name);if(entry.isSymbolicLink())throw Error('SOURCE_SYMLINK');if(entry.isDirectory())await walk(full);else if(entry.isFile())paths.push(full);}}await walk(root);
 let catalog=[];const catalogPath=paths.find(p=>path.basename(p)==='photo-catalog.private.json');if(catalogPath)catalog=JSON.parse(await readFile(catalogPath));
 const files=[];for(const f of inputFiles||[]){const recorded=catalog.find(c=>c.id===f.id)?.path||f.path;if(typeof recorded!=='string')throw Error('PHOTO_PATH_REQUIRED');const found=paths.filter(p=>p.endsWith(recorded)||path.basename(p)===path.basename(recorded));if(found.length!==1)throw Error('PHOTO_PATH_REVIEW');const location=await realpath(found[0]);if(!location.startsWith(local+path.sep))throw Error('PRIVATE_PHOTO_REQUIRED');const bytes=await readFile(location);if(sha(bytes)!==f.sha256||bytes.length!==f.size)throw Error('PHOTO_BYTES_MISMATCH');files.push({id:f.id,diaryId:f.diaryId,ordinal:f.ordinal,path:path.relative(process.cwd(),location),sha256:f.sha256,size:f.size,mime:f.mime});}
 for(const row of entities['일기기록']||[]){const urls=JSON.parse(String(row.cells['사진URLs']||'[]'));row.cells['사진URLs']=JSON.stringify(urls.map((url,ordinal)=>{const f=(inputFiles||[]).find(f=>f.diaryId===row.id&&f.ordinal===ordinal&&f.sourceUrl===url);if(!f)throw Error('PHOTO_MANIFEST_REQUIRED');return f.id;}));}
 const snapshot={format:1,sourceId,synthetic:raw.synthetic===true,complete:true,capturedAt:raw.capturedAt,classId:stableId(sourceId,'class','single-source-roster'),classLabel,identityReviewed:reviewed,teacherBlankClassIds,sourceDispositions,entities,files};
 const output=path.join(local,'source-review');await mkdir(output,{recursive:true,mode:0o700});await writeFile(path.join(output,'snapshot.candidate.private.json'),JSON.stringify(snapshot),{mode:0o600});
 await writeFile(path.join(output,'review.template.private.json'),JSON.stringify({currentDeploymentMatchesSuppliedCode:false,suppliedCodeSha256:codeHash,rawSha256:sha(original)}),{mode:0o600});
 const checked=plan(snapshot),issueCounts={};for(const i of checked.issues)issueCounts[i.code]=(issueCounts[i.code]||0)+1;
 console.log(JSON.stringify({mode:'offline private candidate only',identityReviewed:reviewed,counts:checked.counts,photos:files.length,archivedOriginalRelationships:sourceDispositions.filter(d=>d.reason==='missing-source-parent').length,archivedFlagsWithoutRecord:sourceDispositions.filter(d=>d.reason==='source-flags-without-record').length,archivedDuplicateLikes:sourceDispositions.filter(d=>d.reason==='duplicate-source-like').length,teacherBlankClassExplicitMappings:teacherBlankClassIds.length,issueCounts,sourceWrites:false,remoteImport:false}));
}catch(e){console.error(/^[A-Z_]+$/.test(e.message)?e.message:'PRIVATE_SOURCE_REVIEW_FAILED');process.exitCode=1;}
