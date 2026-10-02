import {spawn} from 'node:child_process';
const p=spawn('node',['node_modules/wrangler/bin/wrangler.js','dev','--ip','127.0.0.1','--port','3020','--persist-to','.local/cloudflare'],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME||'/tmp/okgu-wrangler-config'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>p.kill(signal));p.on('exit',code=>process.exit(code??1));
