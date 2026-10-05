import worker from '../../worker/index.ts';
import {digest} from '../../worker/auth.ts';
import {database} from './d1.mjs';
const site='https://rlasksk030.github.io/okgu-diary-alarm-/',api='https://okgu-diary-api.rlasksk030.workers.dev';
export async function fixture(){
 const db=await database(),background=[];
 db.sqlite.exec("INSERT INTO classes VALUES('c','칭찬검증반'),('other','다른검증반');INSERT INTO accounts(id,legacy_identity,display_name,class_id,role) VALUES('s','test:s','검증학생','c','student'),('p','test:p','검증친구','c','student'),('t','test:t','검증교사','c','teacher'),('f','test:f','다른반교사','other','teacher');");
 for(const id of ['s','p','t','f'])db.sqlite.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await digest('test-'+id),id,Date.now()+600000);
 const env={DB:db.DB,APP_URL:site,WEB_ORIGINS:new URL(site).origin,PUSH_MODE:'disabled'};
 const rpc=async(id,method,args=[],extra={})=>{const request=new Request(api+'/api/rpc',{method:'POST',headers:{Origin:new URL(site).origin,'Content-Type':'application/json','X-OKGU-Request':'1',Authorization:'Bearer test-'+id},body:JSON.stringify({method,args,requestId:crypto.randomUUID(),...extra})});const response=await worker.fetch(request,env,{waitUntil:p=>background.push(p)});return {status:response.status,value:await response.json()};};
 return {...db,env,rpc,async finish(){await Promise.allSettled(background);db.close();}};
}
