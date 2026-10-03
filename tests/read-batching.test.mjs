import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './helpers/d1.mjs';import {read,stats} from '../worker/reads.ts';import {today} from '../worker/store.ts';
test('batched student dashboard keeps full statistics and all-period pagination including old records',async()=>{
 const d=await database();try{
 d.sqlite.exec("INSERT INTO classes VALUES('c','가상반');INSERT INTO accounts(id,legacy_identity,display_name,class_id,role) VALUES('s','test:s','가상학생','c','student'),('t','test:t','가상교사','c','teacher')");
 const insert=d.sqlite.prepare('INSERT INTO diaries(id,author_id,class_id,diary_date,body,mood_emoji,mood_label,mood_color,visibility,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
 for(let i=0;i<61;i++)insert.run('d'+String(i).padStart(3,'0'),'s','c',i<51?today():'2025-01-01','가상 기록 '+i,'🙂','좋아','#111',i%2?'private':'teacher',i<51?i+11:i-50,i<51?i+11:i-50);
 const a={id:'s',role:'student',class_id:'c',display_name:'가상학생'},env={DB:d.DB};let batches=0;const measured={DB:{...d.DB,batch:async q=>{batches++;return d.DB.batch(q);}}};
 const expected=await stats(env,a,'all'),bundle=await read(measured,a,'getStudentDashboard',[],{period:'all'});assert.deepEqual(bundle.stats,expected);assert.deepEqual(bundle.allStats,expected);assert.equal(bundle.entries.length,50);assert.equal(batches,2);
 const tail=await read(env,a,'getMyEntries',[],{period:'all',offset:50});assert.equal(tail.length,11);assert(tail.some(e=>e.date==='2025-01-01'));assert.equal(new Set([...bundle.entries,...tail].map(e=>e.id)).size,61);
 const month=await read(env,a,'getStudentDashboard',[],{period:'month'});assert.equal(month.stats.total,51);assert.equal(month.allStats.total,61);
 }finally{d.close();}
});
test('teacher bulk streaks equal per-student ACL statistics, excluding private/deleted and foreign-class records',async()=>{
 const d=await database();try{
 d.sqlite.exec("INSERT INTO classes VALUES('c','가상반'),('x','다른반');INSERT INTO accounts(id,legacy_identity,display_name,class_id,role) VALUES('s','test:s','가상학생','c','student'),('b','test:b','가상학생B','c','student'),('t','test:t','가상교사','c','teacher'),('x','test:x','다른반학생','x','student')");
 const day=today(),previous=new Date(day+'T00:00:00Z');previous.setUTCDate(previous.getUTCDate()-1);
 const insert=d.sqlite.prepare('INSERT INTO diaries(id,author_id,class_id,diary_date,body,mood_emoji,mood_label,mood_color,visibility,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
 for(const [id,author,cls,date,visibility] of [['d1','s','c',day,'teacher'],['d2','s','c',previous.toISOString().slice(0,10),'class'],['d3','b','c',day,'private'],['dx','x','x',day,'class']])insert.run(id,author,cls,date,'가상 기록','🙂','좋아','#111',visibility,1,1);
 const a={id:'t',role:'teacher',class_id:'c',display_name:'가상교사'},env={DB:d.DB};let calls=0;const measured={DB:{...d.DB,prepare(sql){calls++;return d.DB.prepare(sql);}}};
 const rows=await read(measured,a,'getClassOverview',[],{});assert.equal(calls,2);assert.equal(rows.length,2);
 for(const row of rows)assert.equal(row.streak,(await stats(env,a,'all',row.id)).streak);assert.equal(rows.find(r=>r.id==='b').streak,0);assert.equal(rows.find(r=>r.id==='s').streak,2);
 }finally{d.close();}
});
