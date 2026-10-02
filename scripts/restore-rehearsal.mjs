import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {openSnapshot} from '../migration/snapshot.ts';
import {verifyObjects,fingerprint} from '../migration/backup.ts';
import {sha} from '../migration/core.ts';
if(process.argv.includes('--remote'))throw new Error('Restore rehearsal is local and isolated only');
if(!/^[a-f0-9]{64}$/i.test(process.env.OKGU_BACKUP_KEY||''))throw new Error('Provide the backup key securely');
const backup=openSnapshot(JSON.parse(await readFile(process.argv[2],'utf8')),Buffer.from(process.env.OKGU_BACKUP_KEY,'hex'));verifyObjects(backup);
const directory='.local/restore-rehearsal/'+Date.now();await mkdir(directory,{recursive:true,mode:0o700});
await writeFile(directory+'/restore.sql',backup.sql,{mode:0o600});
process.env.XDG_CONFIG_HOME ||= '/tmp/okgu-wrangler-config';process.env.WRANGLER_SEND_METRICS='false';
const p=spawnSync('node',['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.jsonc','--persist-to',directory,'--file',directory+'/restore.sql'],{stdio:'ignore'});if(p.status!==0)throw new Error('Isolated D1 restore failed; inspect the private local directory');
const {getPlatformProxy}=await import('wrangler');const proxy=await getPlatformProxy({configPath:'wrangler.jsonc',persist:{path:directory+'/v3'}});
try{for(const f of backup.photos)await proxy.env.PHOTOS.put(f.path,Buffer.from(f.bytes,'base64'),{httpMetadata:{contentType:f.mime}});
 for(const [table,rows] of Object.entries(backup.rows)){const restored=(await proxy.env.DB.prepare('SELECT * FROM "'+table.replace(/"/g,'""')+'"').all()).results;if(fingerprint(restored)!==fingerprint(rows))throw new Error('D1 restore row mismatch');}
 if((await proxy.env.DB.prepare('PRAGMA foreign_key_check').all()).results.length)throw new Error('Restored relationship mismatch');
 for(const f of backup.photos){const object=await proxy.env.PHOTOS.get(f.path);if(!object||sha(Buffer.from(await object.arrayBuffer()))!==f.sha256)throw new Error('R2 restore mismatch');}
 console.log('PASS isolated local restore: '+Object.keys(backup.rows).length+' tables, '+backup.photos.length+' originals/thumbnails; exact rows, references and checksums. Current runtime storage was not overwritten.');
}finally{await proxy.dispose();}
