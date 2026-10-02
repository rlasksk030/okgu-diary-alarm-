import {writeFile,mkdir} from 'node:fs/promises';
import {sealSnapshot} from '../migration/snapshot.ts';
if(process.argv.includes('--remote'))throw new Error('Remote backup requires a reviewed production procedure; this command is local only');
if(!/^[a-f0-9]{64}$/i.test(process.env.OKGU_BACKUP_KEY||''))throw new Error('Provide a 64-hex AES-256 key securely');
await mkdir('.local/backups',{recursive:true,mode:0o700});
process.env.XDG_CONFIG_HOME ||= '/tmp/okgu-wrangler-config';
process.env.WRANGLER_SEND_METRICS='false';
const {getPlatformProxy}=await import('wrangler');
const proxy=await getPlatformProxy({configPath:'wrangler.jsonc',persist:{path:'.local/cloudflare/v3'}});
try{const db=proxy.env.DB,r2=proxy.env.PHOTOS;const schema=(await db.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END,name").all()).results;const tables=schema.filter(s=>s.type==='table');const quote=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replace(/'/g,"''")+"'";const sql=['PRAGMA foreign_keys=OFF;'];
 for(const s of schema)sql.push(s.sql+';');for(const table of tables){const rows=(await db.prepare('SELECT * FROM "'+table.name.replace(/"/g,'""')+'"').all()).results;for(const row of rows)sql.push('INSERT INTO "'+table.name+'"('+Object.keys(row).map(k=>'"'+k+'"').join(',')+') VALUES('+Object.values(row).map(quote).join(',')+');');}
 const refs=(await db.prepare('SELECT DISTINCT object_path FROM attachments UNION SELECT object_path FROM photo_uploads').all()).results;const photos=[];for(const row of refs){const object=await r2.get(row.object_path);if(!object)throw new Error('Missing photo in backup');photos.push({path:row.object_path,bytes:Buffer.from(await object.arrayBuffer()).toString('base64')});}const sealed=sealSnapshot({format:'okgu-local-d1-r2-backup-v1',sql:sql.join('\n'),photos},Buffer.from(process.env.OKGU_BACKUP_KEY,'hex'));await writeFile('.local/backups/'+Date.now()+'.enc',JSON.stringify(sealed),{mode:0o600,flag:'wx'});console.log('Encrypted local D1 + R2 backup created; '+photos.length+' object(s). Restore rehearsal is required before real migration.');}finally{await proxy.dispose();}
