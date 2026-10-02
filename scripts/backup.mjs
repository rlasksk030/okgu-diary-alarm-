import {writeFile,mkdir} from 'node:fs/promises';
import {sealSnapshot} from '../migration/snapshot.ts';
import {capture} from '../migration/backup.ts';
if(process.argv.includes('--remote'))throw new Error('Remote backup requires a reviewed production procedure; this command is local only');
if(!/^[a-f0-9]{64}$/i.test(process.env.OKGU_BACKUP_KEY||''))throw new Error('Provide a 64-hex AES-256 key securely');
await mkdir('.local/backups',{recursive:true,mode:0o700});
process.env.XDG_CONFIG_HOME ||= '/tmp/okgu-wrangler-config';
process.env.WRANGLER_SEND_METRICS='false';
const {getPlatformProxy}=await import('wrangler');
const proxy=await getPlatformProxy({configPath:'wrangler.jsonc',persist:{path:'.local/cloudflare/v3'}});
try{const backup=await capture(proxy.env.DB,proxy.env.PHOTOS);const sealed=sealSnapshot(backup,Buffer.from(process.env.OKGU_BACKUP_KEY,'hex'));const file='.local/backups/'+Date.now()+'.enc';await writeFile(file,JSON.stringify(sealed),{mode:0o600,flag:'wx'});console.log('Encrypted local D1 + R2 backup: '+file+'; '+backup.photos.length+' object(s).');}finally{await proxy.dispose();}
