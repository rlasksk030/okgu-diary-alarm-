import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID,randomInt,pbkdf2Sync} from 'node:crypto';
import {database} from './helpers/d1.mjs';import {resetStudentPin} from '../worker/student-pin.ts';import {hashPin,digest,session,login,verifyPin} from '../worker/auth.ts';import worker from '../worker/index.ts';
const fresh=()=>String(randomInt(100,1000)).padStart(4,'0');
async function setup(){
 const db=await database(),hash=await hashPin('0042'),tokens={t:randomUUID(),s:randomUUID(),long:randomUUID(),b:randomUUID(),x:randomUUID()};
 db.sqlite.exec("INSERT INTO classes VALUES('c','가상반'),('x','다른반');INSERT INTO accounts(id,legacy_identity,display_name,class_id,role) VALUES('t','test:t','가상교사','c','teacher'),('s','test:s','가상학생','c','student'),('b','test:b','다른학생','c','student'),('x','test:x','다른반교사','x','teacher')");
 for(const id of ['t','s','b','x'])db.sqlite.prepare('INSERT INTO credentials VALUES(?,?,?)').run(id,id==='s'?'가상학생':id,hash);
 for(const [id,token] of Object.entries(tokens))db.sqlite.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await digest(token),id==='long'?'s':id,Date.now()+(id==='long'?30:1)*86400000);
 db.sqlite.exec("INSERT INTO diaries(id,author_id,class_id,diary_date,body,mood_emoji,mood_label,mood_color,visibility,created_at,updated_at) VALUES('d','s','c','2026-10-02','보존할 가상 일기','🙂','좋아','#111','class',1,1);INSERT INTO attachments(id,diary_id,object_path,ordinal,sha256,byte_size,mime_type,legacy_file_id) VALUES('p','d','private/test',0,'test',1,'image/png',NULL);INSERT INTO diary_comments(id,diary_id,author_id,body,created_at) VALUES('dc','d','t','보존할 댓글',1);INSERT INTO board_posts(id,diary_id,author_id,body,created_at) VALUES('d','d','s','보존할 게시물',1);INSERT INTO board_likes VALUES('d','b',NULL)");
 const a=await session({DB:db.DB},tokens.t);return {...db,tokens,a,env:{DB:db.DB},hash};
}
const request=(id,pin)=>({method:'resetStudentPin',args:[id,pin,pin],requestId:randomUUID()});
test('reset preserves every relation, uses strong salted PIN and revokes all target sessions only; receipts are replay-safe',async()=>{
 const d=await setup(),pin=fresh(),body=request('s',pin);try{
 const tables=['accounts','diaries','attachments','diary_comments','board_posts','board_likes'],before=tables.map(t=>d.sqlite.prepare('SELECT * FROM '+t+' ORDER BY 1').all());
 const response=await resetStudentPin(d.env,d.a,d.tokens.t,body);assert.deepEqual(response,{success:true,studentId:'s',studentName:'가상학생'});
 const current=d.sqlite.prepare('SELECT pin_hash FROM credentials WHERE account_id=?').get('s').pin_hash;assert.match(current,/^pbkdf2\$600000\$/);assert.notEqual(current,d.hash);assert(await verifyPin(pin,current));assert.equal(await verifyPin('0042',current),false);
 for(const token of [d.tokens.s,d.tokens.long])await assert.rejects(session(d.env,token),e=>e.code==='E_AUTH');
 for(const id of ['t','b','x'])assert.equal((await session(d.env,d.tokens[id])).id,id);
 assert.deepEqual(tables.map(t=>d.sqlite.prepare('SELECT * FROM '+t+' ORDER BY 1').all()),before);
 await assert.rejects(login(d.env,'가상학생','0042',false),e=>e.code==='E_AUTH');const newSession=await login(d.env,'가상학생',pin,true);assert.equal(newSession.id,'s');
 assert.deepEqual(await resetStudentPin(d.env,d.a,d.tokens.t,body),response);assert.equal((await session(d.env,newSession.token)).id,'s');
 assert.equal(d.sqlite.prepare('SELECT COUNT(*) n FROM receipts').get().n,1);assert.deepEqual(JSON.parse(d.sqlite.prepare('SELECT result FROM receipts').get().result),response);
 await assert.rejects(resetStudentPin(d.env,d.a,d.tokens.t,{...body,args:['s','0042','0042']}),e=>e.code==='E_CONFLICT');
 }finally{d.close();}
});
test('student, foreign-class teacher, teacher target, inactive target and invalid/unequal PIN cannot mutate credentials',async()=>{
 const d=await setup();try{
 for(const [actor,id] of [['s','b'],['x','s'],['t','t']])await assert.rejects(resetStudentPin(d.env,await session(d.env,d.tokens[actor]),d.tokens[actor],request(id,fresh())),e=>e.code==='E_FORBIDDEN');
 for(const pin of ['42','12345','12a4','１２３４',42,null])await assert.rejects(resetStudentPin(d.env,d.a,d.tokens.t,request('s',pin)),e=>e.code==='E_PIN_FORMAT');
 const body=request('s',fresh());body.args[2]='mismatch';await assert.rejects(resetStudentPin(d.env,d.a,d.tokens.t,body),e=>e.code==='E_PIN_FORMAT');
 d.sqlite.exec("UPDATE accounts SET active=0 WHERE id='s'");await assert.rejects(resetStudentPin(d.env,d.a,d.tokens.t,request('s',fresh())),e=>e.code==='E_FORBIDDEN');
 assert.equal(d.sqlite.prepare('SELECT pin_hash FROM credentials WHERE account_id=?').get('s').pin_hash,d.hash);assert.equal(d.sqlite.prepare('SELECT COUNT(*) n FROM receipts').get().n,0);
 const response=await worker.fetch(new Request('https://trial.example/api/rpc',{method:'POST',headers:{Origin:'https://trial.example','Content-Type':'application/json','X-OKGU-Request':'1'},body:JSON.stringify(request('s',fresh()))}),{...d.env,WEB_ORIGINS:'https://trial.example'},{waitUntil(){}});assert.equal(response.status,401);
 }finally{d.close();}
});
for(const race of ['teacher downgrade','teacher expiry','target role','target class','credential conflict'])test('atomic authority/CAS prevents '+race+' during KDF',async()=>{
 const d=await setup();try{
 const LOGIN_KDF={idFromName:k=>k,get:()=>({fetch:async(_url,options)=>{
 const {pin,salt,iterations}=JSON.parse(options.body),bits=pbkdf2Sync(pin,salt,iterations,32,'sha256');
 if(race==='teacher downgrade')d.sqlite.exec("UPDATE accounts SET role='student' WHERE id='t'");
 if(race==='teacher expiry')d.sqlite.exec("UPDATE sessions SET expires_at=0 WHERE account_id='t'");
 if(race==='target role')d.sqlite.exec("UPDATE accounts SET role='teacher' WHERE id='s'");
 if(race==='target class'){d.sqlite.exec('PRAGMA foreign_keys=OFF');d.sqlite.exec("UPDATE accounts SET class_id='x' WHERE id='s'");}
 if(race==='credential conflict')d.sqlite.prepare('UPDATE credentials SET pin_hash=? WHERE account_id=?').run(await hashPin(fresh()),'s');
 return new Response(bits);
 }})};
 await assert.rejects(resetStudentPin({...d.env,LOGIN_KDF},d.a,d.tokens.t,request('s',fresh())),e=>e.code==='E_CONFLICT');
 assert.equal(d.sqlite.prepare("SELECT COUNT(*) n FROM sessions WHERE account_id='s'").get().n,2);
 if(race!=='credential conflict')assert.equal(d.sqlite.prepare('SELECT pin_hash FROM credentials WHERE account_id=?').get('s').pin_hash,d.hash);
 }finally{d.close();}
});
test('database failure rolls back credential, receipt and revocation; same request can safely retry',async()=>{
 const d=await setup(),body=request('s',fresh());try{
 const DB={...d.DB,prepare(sql){const statement=d.DB.prepare(sql);if(sql.startsWith('DELETE FROM sessions'))statement.run=async()=>{throw new Error('synthetic transaction failure');};return statement;}};
 await assert.rejects(resetStudentPin({DB},d.a,d.tokens.t,body),/synthetic transaction failure/);
 assert.equal(d.sqlite.prepare('SELECT pin_hash FROM credentials WHERE account_id=?').get('s').pin_hash,d.hash);assert.equal(d.sqlite.prepare('SELECT COUNT(*) n FROM receipts').get().n,0);assert.equal((await session(d.env,d.tokens.long)).id,'s');
 assert.equal((await resetStudentPin(d.env,d.a,d.tokens.t,body)).success,true);
 }finally{d.close();}
});
test('an in-flight old-PIN login cannot mint a session after reset commits',async()=>{
 const d=await setup(),pin=fresh();let batches=0;try{
 const DB={...d.DB,batch:async statements=>{if(++batches===2)await resetStudentPin(d.env,d.a,d.tokens.t,request('s',pin));return d.DB.batch(statements);}};
 await assert.rejects(login({DB},'가상학생','0042',true),e=>e.code==='E_AUTH');
 assert.equal(d.sqlite.prepare("SELECT COUNT(*) n FROM sessions WHERE account_id='s'").get().n,0);
 assert.equal((await login(d.env,'가상학생',pin,true)).id,'s');
 assert.equal((await session(d.env,d.tokens.b)).id,'b');
 }finally{d.close();}
});
