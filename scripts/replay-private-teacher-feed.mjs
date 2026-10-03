// Source-backup replay only. No Google/Cloudflare operations or private row output.
import {readFile,writeFile,realpath} from 'node:fs/promises';import path from 'node:path';import vm from 'node:vm';
try{
 const local=await realpath('.local'),input=await realpath(process.argv[2]);if(!input.startsWith(local+path.sep))throw Error('PRIVATE_INPUT');
 const raw=JSON.parse(await readFile(input));if(raw.synthetic!==false||!raw.complete)throw Error('SOURCE');
 const sheets=new Map(Object.entries(raw.sheets).map(([name,s])=>[name,{headers:s.headers,rows:s.rows.map(r=>r.map(v=>v?.type==='date'?new Date(v.iso):v))}]));
 let mutationAttempts=0;
 const sheet=name=>{const s=sheets.get(name);if(!s)throw Error('MISSING_SHEET');return {getLastColumn:()=>s.headers.length,getDataRange:()=>({getValues:()=>structuredClone([s.headers,...s.rows])}),getRange:(row,col,n=1,m=1)=>({getValues:()=>structuredClone([s.headers,...s.rows].slice(row-1,row-1+n).map(r=>r.slice(col-1,col-1+m))),setValue(){mutationAttempts++;throw Error('SOURCE_MUTATION_ATTEMPT');}})};};
 const context=vm.createContext({Date,SpreadsheetApp:{openById:()=>({getSheetByName:sheet})}});
 vm.runInContext(await readFile('reference/Code.original.redacted.gs','utf8'),context);vm.runInContext('_requireTeacher=function(){return {role:"선생님"};};',context);
 const rows=vm.runInContext('getRecentEntries("synthetic-replay-only",13,0)',context);
 await writeFile('.local/feed-diagnostics/replayed-response.private.json',JSON.stringify(rows),{mode:0o600});
 const report={checkedAt:new Date().toISOString(),environment:'actual uploaded backup + supplied GAS code in isolated mock; NOT live teacher response',backupCapturedAt:raw.capturedAt,suppliedCodeQuerySucceeded:true,returnedRows:rows.length,canonicalDateCount:rows.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)).length,sourceMutationAttempts:mutationAttempts,liveSourceRead:false,incidentCauseConfirmed:false};
 await writeFile('docs/검증/feed-private-replay-20261003.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{console.error('PRIVATE_TEACHER_FEED_REPLAY_FAILED: no private rows/errors logged');process.exitCode=1;}
