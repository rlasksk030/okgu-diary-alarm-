import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {d1Import} from '../migration/d1.ts';import {delta,applyDelta} from '../migration/delta.ts';
const source=JSON.parse(await readFile('fixtures/snapshot.json','utf8'));if(!source.synthetic)throw new Error('Synthetic fixture required');
const directory='.local/delta-rehearsal/'+Date.now();await mkdir(directory,{recursive:true,mode:0o700});
const schema=(await Promise.all((await readdir('migrations')).filter(n=>n.endsWith('.sql')).sort().map(n=>readFile('migrations/'+n,'utf8')))).join('\n');
await writeFile(directory+'/seed.sql',schema+'\n'+d1Import(source).sql,{mode:0o600});
process.env.XDG_CONFIG_HOME ||= '/tmp/okgu-wrangler-config';process.env.WRANGLER_SEND_METRICS='false';
const p=spawnSync('node',['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to',directory,'--file',directory+'/seed.sql'],{stdio:'ignore'});if(p.status)throw new Error('Isolated synthetic seed failed');
const {getPlatformProxy}=await import('wrangler');const proxy=await getPlatformProxy({configPath:'wrangler.jsonc',persist:{path:directory+'/v3'}});
try{const db=proxy.env.DB;const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all()).results;const rows=async()=>Object.fromEntries(await Promise.all(tables.map(async r=>[r.name,(await db.prepare('SELECT * FROM "'+r.name+'"').all()).results])));
 const baseline=await rows(),after=structuredClone(source);after.entities['일기기록'][0].cells['일기내용']='D1 변화분 가상 수정';
 const prepared=delta(source,after,baseline,await rows());await applyDelta(db,prepared);await applyDelta(db,prepared);
 const entry=await db.prepare('SELECT body,version FROM diaries WHERE legacy_id=?').bind(source.entities['일기기록'][0].id).first();if(entry.body!=='D1 변화분 가상 수정'||entry.version!==2)throw new Error('Delta mismatch');
 const next=structuredClone(after);next.entities['일기기록'][0].cells['일기내용']='경쟁하는 원본 수정';const clean=await rows(),stale=delta(after,next,clean,clean);await db.prepare('UPDATE diaries SET body=? WHERE legacy_id=?').bind('새 서버 가상 수정',source.entities['일기기록'][0].id).run();
 let blocked=false;try{await applyDelta(db,stale);}catch{blocked=true;}if(!blocked)throw new Error('Stale target must rollback');
 console.log('PASS isolated local D1 atomic delta: source edit, version, retry deduplication and stale-target full rollback. No remote resources modified.');
}finally{await proxy.dispose();}
