// Initial import into a paused, unconnected production target. Never a live delta.
import {DatabaseSync} from 'node:sqlite';import {readFileSync,readdirSync} from 'node:fs';
import {d1Import} from './d1';import {fingerprint} from './backup';import type {Snapshot} from './core';
export function prepareInitialImport(snapshot:Snapshot,maxStatements=40,maxBytes=60000){
 const db=new DatabaseSync(':memory:');
 try{
  for(const f of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+f,'utf8'));
  const imported=d1Import(snapshot);db.exec(imported.sql);db.exec('UPDATE operation_control SET writes_paused=1');
  const tables=(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as {name:string}[]).map(t=>t.name).sort();
  const expected:Record<string,any[]>={},keys:Record<string,string[]>={};
  for(const table of tables){expected[table]=db.prepare('SELECT * FROM "'+table+'"').all();keys[table]=(db.prepare('PRAGMA table_info("'+table+'")').all() as any[]).filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name);if(!keys[table].length)throw Error('E_IMPORT_TABLE_KEY');}
  const chunks:string[][]=[];let chunk:string[]=[];
  for(const sql of imported.statements){if(Buffer.byteLength(JSON.stringify({sql}))>maxBytes)throw Error('E_IMPORT_STATEMENT_SIZE');if(chunk.length&&(chunk.length>=maxStatements||Buffer.byteLength(JSON.stringify({sql:[...chunk,sql].join('\n')}))>maxBytes)){chunks.push(chunk);chunk=[];}chunk.push(sql);}if(chunk.length)chunks.push(chunk);
  return {expected,keys,chunks,batch:imported.batch};
 }finally{db.close();}
}
export function assertImportSubset(prepared:ReturnType<typeof prepareInitialImport>,live:Record<string,any[]>,final=false){
 if(Object.keys(live).sort().join('|')!==Object.keys(prepared.expected).sort().join('|'))throw Error('E_IMPORT_SCHEMA_MISMATCH');
 for(const [table,expected] of Object.entries(prepared.expected)){
  if(!Array.isArray(live[table]))throw Error('E_IMPORT_ROWS_MISSING');
  const key=(r:any)=>JSON.stringify(prepared.keys[table].map(k=>r[k])),byKey=new Map(expected.map(r=>[key(r),r]));
  for(const actual of live[table]){const row=byKey.get(key(actual));if(!row||Object.keys(actual).sort().join('|')!==Object.keys(row).sort().join('|'))throw Error('E_IMPORT_TARGET_CHANGED');
   for(const column of Object.keys(row)){const pendingParent=!final&&['board_comments','diary_comments'].includes(table)&&column==='parent_id'&&actual[column]===null;
    if(!pendingParent&&actual[column]!==row[column])throw Error('E_IMPORT_TARGET_CHANGED');}
  }
  if(final&&fingerprint(live[table])!==fingerprint(expected))throw Error('E_IMPORT_FINAL_MISMATCH');
 }
}
export async function executeInitialImport(prepared:ReturnType<typeof prepareInitialImport>,io:{assertPaused:()=>Promise<void>;rows:()=>Promise<Record<string,any[]>>;query:(sql:string)=>Promise<void>;checkpoint:(chunk:number)=>Promise<void>}){
 await io.assertPaused();assertImportSubset(prepared,await io.rows());
 try{
  for(let i=0;i<prepared.chunks.length;i++){
   await io.assertPaused();
   // REST multi-statement execution is not claimed to be one whole-import transaction.
   // On a partial failure, existing source rows must match this exact import to resume.
   await io.query('UPDATE operation_control SET writes_paused=0 WHERE id=1;');
   await io.query(prepared.chunks[i].join('\n'));
   await io.query('UPDATE operation_control SET writes_paused=1 WHERE id=1;');
   await io.checkpoint(i+1);
  }
 }finally{await io.query('UPDATE operation_control SET writes_paused=1 WHERE id=1;');}
 await io.assertPaused();assertImportSubset(prepared,await io.rows(),true);
}
