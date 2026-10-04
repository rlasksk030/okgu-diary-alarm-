import {mkdir,readFile,writeFile,copyFile,rm,readdir} from 'node:fs/promises';
const api=process.env.OKGU_TRIAL_API_ORIGIN||'';
if(api&&!/^https:\/\/[a-z0-9.-]+$/.test(api))throw new Error('Use an HTTPS trial API origin');
const local=process.argv.includes('--local');
if(local&&process.env.CI)throw new Error('Local build must not run in CI');
const vapid=process.env.VAPID_PUBLIC_KEY||'';if(vapid&&!/^[A-Za-z0-9_-]{87}$/.test(vapid))throw new Error('Invalid public VAPID key');
await mkdir('trial-web/okgu-diary-alarm-',{recursive:true});
const allowed=new Set(['index.html','manifest.json','sw.js','okgu_icon.png','rpc.js','fast-ui.js','student-pin.js','config.js','.nojekyll']);
for(const folder of ['trial-web','trial-web/okgu-diary-alarm-'])for(const name of await readdir(folder))if(!allowed.has(name)&&!(folder==='trial-web'&&name==='okgu-diary-alarm-'))await rm(folder+'/'+name,{recursive:true,force:true});
for(const folder of ['trial-web','trial-web/okgu-diary-alarm-']){
 for(const file of ['index.html','manifest.json','sw.js','okgu_icon.png','rpc.js','fast-ui.js','student-pin.js'])await copyFile(file,folder+'/'+file);
 await writeFile(folder+'/config.js','window.OKGU_CONFIG={apiOrigin:'+JSON.stringify(local?'http://127.0.0.1:3020':api)+'||window.location.origin,vapidPublicKey:'+JSON.stringify(vapid)+',version:"cloud-write-20261004"};\n');
 await writeFile(folder+'/.nojekyll','');
}
const html=await readFile('trial-web/index.html','utf8');if(html.includes('script.google.com')||html.includes('CHUNK_SIZE'))throw new Error('Legacy transport in bundle');
console.log('Static trial bundle built. Contains no database, secrets or student data.');
