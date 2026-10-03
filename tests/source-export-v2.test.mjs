import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {Script,createContext} from 'node:vm';
async function setup(){
 const code=await readFile('migration/source/ReadOnlyExportV2.gs','utf8');let uid=0,rootWrites=0,tick=0,partial=true;
 const files=new Map(),folders=new Map(),props=new Map([['OKGU_SOURCE_SPREADSHEET_ID','original-sheet']]);
 const it=a=>{let i=0;return {hasNext:()=>i<a.length,next:()=>a[i++]};};
 const blob=(b,name='photo',mime='image/jpeg')=>({getBytes:()=>[...Buffer.from(b)],getDataAsString:()=>Buffer.from(b).toString(),getContentType:()=>mime,getName:()=>name,copyBlob:()=>blob(b,name,mime),setName(n){name=n;return this;}});
 const makeFile=(id,b,parent,source=false)=>{let content=b;const f={getId:()=>id,getName:()=>id,getBlob:()=>blob(content),getSize:()=>Buffer.byteLength(content),getMimeType:()=>source?'image/jpeg':'text/plain',getParents:()=>it([parent]),setContent(s){if(source){rootWrites++;throw Error('original mutation');}content=s;},getDescription:()=>''};files.set(id,f);return f;};
 const makeFolder=(id,source=false)=>{const fs=[];let privacy='PRIVATE';const f={getId:()=>id,getName:()=>id,getSharingAccess:()=>privacy,getEditors:()=>[],getViewers:()=>[],setSharing(a){if(source){rootWrites++;throw Error('source mutation');}privacy=a;},getFiles:()=>it(fs),getFolders:()=>it([]),getFilesByName:n=>it(fs.filter(x=>x.getName()===n)),createFile(arg,text){if(source){rootWrites++;throw Error('source mutation');}const name=typeof arg==='string'?arg:arg.getName(),data=typeof arg==='string'?text:Buffer.from(arg.getBytes());const x=makeFile('new-'+(++uid),data,f);x.getName=()=>name;fs.push(x);if(name==='checkpoint.private.json'&&partial){const write=x.setContent;x.setContent=s=>{write(s);if(JSON.parse(s).cursor===1)tick=250000;};}return x;}};folders.set(id,f);return f;};
 const root=makeFolder('root',true);const originals=[makeFile('photo-1','fake-original-1',root,true),makeFile('photo-2','fake-original-2',root,true)];root.getFiles=()=>it(originals);
 let rows=[['fake-diary','["https://drive.google.com/thumbnail?id=photo-1&sz=w600"]']];
 const sheet={getName:()=> '일기기록',getDataRange:()=>({getValues:()=>[['날짜',''],...rows],getDisplayValues:()=>[['날짜',''],...rows],getNumberFormats:()=>[['@','@'],...rows.map(()=>['@','@'])],getFormulas:()=>[['',''],...rows.map(()=>['',''])]}),getLastRow:()=>rows.length+1,getLastColumn:()=>2};
 const context=createContext({console:{log(){}},Date:class extends Date{static now(){return tick;}},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperties:o=>Object.entries(o).forEach(([k,v])=>props.set(k,v)),deleteProperty:k=>props.delete(k)})},SpreadsheetApp:{openById:id=>{assert.equal(id,'original-sheet');return {getSheets:()=>[sheet],getSpreadsheetTimeZone:()=> 'Asia/Seoul'};}},DriveApp:{Access:{PRIVATE:'PRIVATE'},Permission:{NONE:'NONE'},getFolderById:id=>folders.get(id),getFileById:id=>files.get(id),getFoldersByName:name=>{assert.equal(name,'OKGU_DIARY_사진');return it([root]);},createFolder:()=>makeFolder('backup-'+(++uid))},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_alg,b)=>[...createHash('sha256').update(Buffer.from(b)).digest()],newBlob:s=>blob(s),formatDate:()=> 'fake-date'},MimeType:{PLAIN_TEXT:'text/plain'}});
 new Script(code).runInContext(context);
 return {context,props,folders,files,rootWrites:()=>rootWrites,resume(){partial=false;tick=0;},change(){rows[0][0]='changed';}};
}
test('read-only exporter handles actual header drift, resumes without duplicate photo copies, keeps original IDs and verifies full photos',async()=>{
 const m=await setup();let r=m.context.exportOkguReadOnly();assert.equal(r.complete,false);assert.equal(r.copied,1);
 m.resume();r=m.context.exportOkguReadOnly();assert.equal(r.complete,true);assert.equal(r.copied,2);assert.equal(r.verified,2);assert.equal(r.referenceCount,1);assert.equal(m.rootWrites(),0);
 const f=m.folders.get(m.props.get('OKGU_PRIVATE_BACKUP_FOLDER_ID'));const raw=JSON.parse(f.getFilesByName('raw.private.json').next().getBlob().getDataAsString());
 assert.equal(raw.sheets['일기기록'].headers[0],'날짜');assert.equal(raw.photoReferences[0].id,'photo-1');assert.equal(raw.photos.length,2);assert(raw.photos.every(p=>p.id!==p.backupId));
 const iterator=f.getFiles();let photoCount=0;while(iterator.hasNext())if(iterator.next().getName().endsWith('.original'))photoCount++;assert.equal(photoCount,2);
 assert.equal(m.context.exportOkguReadOnly().complete,true);
});
test('source row changes prevent a complete final snapshot and preserve the old backup',async()=>{
 const m=await setup();m.context.exportOkguReadOnly();m.change();m.resume();assert.throws(()=>m.context.exportOkguReadOnly(),/SOURCE_CHANGED_START_NEW_BACKUP/);
 const originalFolder=m.props.get('OKGU_PRIVATE_BACKUP_FOLDER_ID');const r=m.context.startNewOkguBackup();assert.equal(r.complete,true);assert(m.folders.has(originalFolder));assert.notEqual(m.props.get('OKGU_PRIVATE_BACKUP_FOLDER_ID'),originalFolder);assert.equal(m.rootWrites(),0);
});
