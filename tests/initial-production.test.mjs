import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {prepareInitialImport,executeInitialImport,assertImportSubset} from '../migration/initial-production.ts';import {database} from './helpers/d1.mjs';
const fixture=JSON.parse(await readFile('fixtures/snapshot.json'));
test('paused initial import resumes a partial multi-statement failure without duplicates and preserves quoted multiline content',async()=>{
 const snapshot=structuredClone(fixture);snapshot.entities['일기기록'][0].cells['일기내용']="가상 본문;\n두 번째 줄 '인용'";
 const prepared=prepareInitialImport(snapshot,3),db=await database();db.sqlite.exec('UPDATE operation_control SET writes_paused=1');let fail=true,sourceQueries=0;
 const rows=async()=>Object.fromEntries(Object.keys(prepared.expected).map(t=>[t,db.sqlite.prepare('SELECT * FROM "'+t+'"').all()]));
 const io={rows,checkpoint:async()=>{},assertPaused:async()=>assert.equal(db.sqlite.prepare('SELECT writes_paused FROM operation_control').get().writes_paused,1),query:async sql=>{if(sql.startsWith('INSERT')){sourceQueries++;if(fail&&sourceQueries===2){db.sqlite.exec(prepared.chunks[1][0]);throw Error('E_SIMULATED_PARTIAL');}}db.sqlite.exec(sql);}};
 try{await assert.rejects(executeInitialImport(prepared,io),/E_SIMULATED_PARTIAL/);assert.equal(db.sqlite.prepare('SELECT writes_paused FROM operation_control').get().writes_paused,1);fail=false;await executeInitialImport(prepared,io);const counts=db.sqlite.prepare('SELECT count(*) n FROM diaries').get().n;await executeInitialImport(prepared,io);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM diaries').get().n,counts);assert.equal(db.sqlite.prepare('SELECT body FROM diaries WHERE legacy_id=?').get(snapshot.entities['일기기록'][0].id).body,snapshot.entities['일기기록'][0].cells['일기내용']);assertImportSubset(prepared,await rows(),true);}finally{db.close();}
});
test('new or edited target rows stop resume before unlocking or overwriting',()=>{
 const p=prepareInitialImport(fixture),rows=structuredClone(p.expected);rows.diaries[0].body='가상 새 서버 수정';assert.throws(()=>assertImportSubset(p,rows),/E_IMPORT_TARGET_CHANGED/);const extra=structuredClone(p.expected);extra.sessions.push({token_hash:'virtual-only',account_id:extra.accounts[0].id,expires_at:1});assert.throws(()=>assertImportSubset(p,extra),/E_IMPORT_TARGET_CHANGED/);assert.throws(()=>prepareInitialImport({...fixture,identityReviewed:false}),/IMPORT_PLAN_HAS_ISSUES/);
});
test('chunk limits apply to encoded requests, preserving complete statements and rejecting an oversized statement',()=>{
 const p=prepareInitialImport(fixture,4);assert(p.chunks.every(c=>c.length<=4&&Buffer.byteLength(JSON.stringify({sql:c.join('\n')}))<=60000));assert.throws(()=>prepareInitialImport(fixture,4,30),/E_IMPORT_STATEMENT_SIZE/);
});
