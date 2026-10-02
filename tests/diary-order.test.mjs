import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './helpers/d1.mjs';
import {read} from '../worker/reads.ts';

test('main ordering follows saved time for feed/search, insertion time for teacher modal, with ACL before pagination',async()=>{
 const db=await database();try{
  db.sqlite.exec("INSERT INTO classes VALUES('c','가상반');INSERT INTO accounts(id,legacy_identity,display_name,class_id,role) VALUES('s','synthetic:s','가상학생','c','student'),('t','synthetic:t','가상교사','c','teacher')");
  const insert=db.sqlite.prepare('INSERT INTO diaries(id,author_id,class_id,diary_date,body,mood_emoji,mood_label,mood_color,visibility,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  for(const [id,date,created,updated,visibility] of [['older','2026-01-01',1000,5000,'teacher'],['newer','2026-10-03',2000,2000,'class'],['private','2026-10-03',9000,9000,'private']])insert.run(id,'s','c',date,id==='private'?'비공개 가상':'order marker','😄','신남','#111',visibility,created,updated);
  const teacher={id:'t',role:'teacher',class_id:'c',display_name:'가상교사',label:'가상반'},student={...teacher,id:'s',role:'student',display_name:'가상학생'},env={DB:db.DB};
  assert.deepEqual((await read(env,teacher,'getRecentEntries',['',13,0],{})).map(e=>e.id),['older','newer']);
  assert.deepEqual((await read(env,student,'searchEntries',['order marker'],{})).entries.map(e=>e.id),['older','newer']);
  assert.deepEqual((await read(env,teacher,'getStudentEntries',['','가상학생'],{})).map(e=>e.id),['newer','older']);
  assert.deepEqual((await read(env,teacher,'getStudentEntries',['','가상학생'],{offset:1})).map(e=>e.id),['older']);
  assert.deepEqual((await read(env,teacher,'exportEntries',['가상학생'],{})).entries.map(e=>e.id),['newer','older']);
 }finally{db.close();}
});
