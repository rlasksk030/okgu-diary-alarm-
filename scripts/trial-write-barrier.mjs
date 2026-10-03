// Administrative trial-only barrier; no browser API or production writes.
import {requireTrialBranch,cloudflareClient,trialDatabaseId,verifyTrialData} from './lib/trial-cloudflare.mjs';
requireTrialBranch();const mode=process.argv[2];if(!['paused','active'].includes(mode))throw Error('E_WRITE_MODE');
const client=cloudflareClient(),id=await trialDatabaseId();await verifyTrialData(client,id);
const result=await client.accountCall('POST','/d1/database/'+id+'/query',{sql:'UPDATE operation_control SET writes_paused=? WHERE id=1 RETURNING writes_paused',params:[mode==='paused'?1:0]});
if(!result[0]?.success||result[0].results?.[0]?.writes_paused!==(mode==='paused'?1:0))throw Error('E_WRITE_BARRIER');
console.log('Dedicated synthetic D1 write barrier: '+mode);
