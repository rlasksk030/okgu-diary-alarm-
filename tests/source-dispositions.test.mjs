import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {database} from './helpers/d1.mjs';import {plan,sha} from '../migration/core.ts';import {d1Import} from '../migration/d1.ts';
const fixture=JSON.parse(await readFile('fixtures/snapshot.json','utf8'));
test('existing missing-parent rows remain exactly archived without fabricated parents; source-bound exceptions cannot conceal valid content',async()=>{
 const s=structuredClone(fixture),row=structuredClone(s.entities['선생님댓글'][0]);row.id='fake-source-orphan';row.cells.ID=row.id;row.cells['일기ID']='missing-source-parent';row.cells['부모댓글ID']='';s.entities['선생님댓글'].push(row);
 assert(plan(s).issues.some(i=>i.code==='BROKEN_DIARY_REFERENCE'));
 s.sourceDispositions=[{entity:'선생님댓글',id:row.id,hash:sha(JSON.stringify(row)),reason:'missing-source-parent'}];assert.equal(plan(s).issues.length,0);
 const db=await database();try{db.sqlite.exec(d1Import(s).sql);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM diaries WHERE legacy_id=?').get('missing-source-parent').n,0);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM diary_comments WHERE legacy_id=?').get(row.id).n,0);assert.deepEqual(JSON.parse(db.sqlite.prepare('SELECT payload FROM source_archive WHERE legacy_id=?').get(row.id).payload),row);}finally{db.close();}
 row.cells['일기ID']=s.entities['일기기록'][0].id;s.sourceDispositions[0].hash=sha(JSON.stringify(row));assert(plan(s).issues.some(i=>i.code==='INVALID_SOURCE_DISPOSITION'));assert.throws(()=>d1Import(s));
});
test('blank teacher class is explicitly mapped only for teacher; duplicate original likes remain archived with one active relationship',async()=>{
 const s=structuredClone(fixture),teacher=s.entities['학생계정'].find(r=>r.cells['역할']==='선생님');teacher.cells['반']='';assert(plan(s).issues.some(i=>i.code==='CLASS_MISMATCH'));s.teacherBlankClassIds=[teacher.id];assert.equal(plan(s).issues.length,0);
 const row=structuredClone(s.entities['게시판좋아요'][0]);row.id='fake-duplicate-like';s.entities['게시판좋아요'].push(row);s.sourceDispositions=[{entity:'게시판좋아요',id:row.id,hash:sha(JSON.stringify(row)),reason:'duplicate-source-like'}];assert.equal(plan(s).issues.length,0);
 const db=await database();try{const sql=d1Import(s).sql;db.sqlite.exec(sql);db.sqlite.exec(sql);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM board_likes').get().n,fixture.entities['게시판좋아요'].length);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM source_archive WHERE legacy_id=?').get(row.id).n,1);}finally{db.close();}
 const student=s.entities['학생계정'].find(r=>r.cells['역할']==='학생');student.cells['반']='';s.teacherBlankClassIds.push(student.id);assert(plan(s).issues.some(i=>i.code==='CLASS_MISMATCH'));
});
