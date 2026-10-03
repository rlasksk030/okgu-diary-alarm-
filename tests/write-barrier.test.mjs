import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './helpers/d1.mjs';
import {d1Import} from '../migration/d1.ts';
import {capture,fingerprint} from '../migration/backup.ts';
import {readFile} from 'node:fs/promises';
const source=JSON.parse(await readFile('fixtures/snapshot.json','utf8'));
test('shared D1 freeze blocks old and new writers atomically; reads/logout survive; rollback restores paused state and exact data',async()=>{
 const db=await database(),restored=await database();try{
  db.sqlite.exec(d1Import(source).sql);const account=db.sqlite.prepare('SELECT id FROM accounts LIMIT 1').get().id;
  db.sqlite.prepare("INSERT INTO sessions VALUES('synthetic-token',?,?)").run(account,Date.now()+10000);
  db.sqlite.exec('UPDATE operation_control SET writes_paused=1 WHERE id=1');
  const before=db.sqlite.prepare('SELECT * FROM diaries').all();
  assert.throws(()=>db.sqlite.exec("UPDATE diaries SET body='must not persist'"),/OKGU_WRITE_PAUSED/);
  assert.throws(()=>db.sqlite.exec('DELETE FROM accounts'),/OKGU_WRITE_PAUSED/);
  await assert.rejects(db.DB.batch([db.DB.prepare("DELETE FROM sessions WHERE token_hash='synthetic-token'"),db.DB.prepare("UPDATE credentials SET pin_hash='must not persist'")]),/OKGU_WRITE_PAUSED/);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n,1,'blocked batch rolls back even otherwise permitted logout');
  assert.equal(fingerprint(db.sqlite.prepare('SELECT * FROM diaries').all()),fingerprint(before));
  db.sqlite.exec("DELETE FROM sessions WHERE token_hash='synthetic-token'");
  const bytes=await readFile('fixtures/photo.png'),r2={get:async()=>({arrayBuffer:async()=>bytes,httpMetadata:{contentType:'image/png'}})};
  const backup=await capture(db.DB,r2);
  restored.sqlite.exec('PRAGMA foreign_keys=OFF');for(const t of restored.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all())restored.sqlite.exec('DROP TABLE "'+t.name+'"');
  restored.sqlite.exec(backup.sql);
  for(const [table,rows] of Object.entries(backup.rows))assert.equal(fingerprint(restored.sqlite.prepare('SELECT * FROM "'+table+'"').all()),fingerprint(rows));
  assert.throws(()=>restored.sqlite.exec("UPDATE diaries SET body='blocked after restore'"),/OKGU_WRITE_PAUSED/);
  restored.sqlite.exec('UPDATE operation_control SET writes_paused=0 WHERE id=1');restored.sqlite.exec("UPDATE diaries SET body='resumed' WHERE id=(SELECT id FROM diaries LIMIT 1)");
 }finally{db.close();restored.close();}
});
