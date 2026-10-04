import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
import {database} from './helpers/d1.mjs';import {incidentEntry} from '../migration/incident-entry.ts';import {read} from '../worker/reads.ts';import {patchGas,guarded} from '../scripts/prepare-gas-cutover-guard.mjs';
const row=['legacy-diary','2026-10-04','가상학생','🙂','좋아','#111','보존할 가상 글',false,false,false,'2026-10-04T08:23:14.266Z','[]'];
const account={id:'student',legacy_identity:'sheet:test:stable-student',display_name:'가상학생',class_id:'class',role:'student',active:1};
test('single-entry insertion keeps existing Cloudflare rows, is idempotent, and resolves legacy links with ACL',async()=>{
 const d=await database();try{
 d.sqlite.exec("INSERT INTO classes VALUES('class','가상반');INSERT INTO accounts VALUES('student','sheet:test:stable-student','가상학생','class','student',1),('teacher','sheet:test:teacher','가상교사','class','teacher',1)");
 const p=incidentEntry(row,account,'sheet:test',true);
 await d.DB.prepare(p.sql).bind(...p.params).run();await d.DB.prepare(p.sql).bind(...p.params).run();
 assert.equal(d.sqlite.prepare('SELECT count(*) n FROM diaries').get().n,1);
 const entry=await read({DB:d.DB},{id:'teacher',class_id:'class',role:'teacher'},'getEntry',[row[0]],{});assert.equal(entry.text,row[6]);assert.equal(entry.id,p.entry.id);
 const feed=await read({DB:d.DB},{id:'teacher',class_id:'class',role:'teacher'},'getRecentEntries',['',13,0],{});assert.equal(feed[0].id,p.entry.id);
 d.sqlite.prepare('UPDATE diaries SET body=?,version=2,visibility=? WHERE id=?').run('Cloudflare 최신 내용','private',p.entry.id);
 await d.DB.prepare(p.sql).bind(...p.params).run();assert.equal(d.sqlite.prepare('SELECT body FROM diaries').get().body,'Cloudflare 최신 내용');
 await assert.rejects(read({DB:d.DB},{id:'teacher',class_id:'class',role:'teacher'},'getEntry',[row[0]],{}));
 assert.equal(d.sqlite.prepare('SELECT count(*) n FROM push_jobs').get().n,0);
 }finally{d.close();}
});
test('recovery refuses unverified children, photos and ambiguous account mapping',()=>{
 assert.throws(()=>incidentEntry(row,account,'sheet:test',false));
 assert.throws(()=>incidentEntry([...row.slice(0,11),'["photo"]'],account,'sheet:test',true));
 assert.throws(()=>incidentEntry(row,{...account,display_name:'다른학생'},'sheet:test',true));
 assert.throws(()=>incidentEntry(row,{...account,legacy_identity:'other:identity'},'sheet:test',true));
});
test('GAS guard blocks legacy writes and push dispatch before side effects, leaves reads available',async()=>{
 const source=await readFile('reference/Code.original.redacted.gs','utf8');const patched=patchGas(source);assert.equal((patched.match(/  _okguCloudflareOnly_\(\);/g)||[]).length,guarded.length);
 let mutations=0;const fake=guarded.map(name=>'function '+name+'(){mutate();}').join('\n')+'\nfunction getRecentEntries(){return ["preserved"];}';
 const c=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'yes'})},mutate:()=>mutations++});vm.runInContext(patchGas(fake),c);
 for(const name of guarded)assert.throws(()=>c[name](),/업데이트/);assert.equal(mutations,0);assert.equal(c.getRecentEntries()[0],'preserved');
});
