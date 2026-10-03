// Independent synthetic frontend, to test genuine cross-origin API calls and SW updates.
// No database, R2, credentials, push transport, cron or API proxy in this Worker.
export default {fetch(req:Request,env:{ASSETS:Fetcher}){
 const u=new URL(req.url);if(u.pathname.startsWith('/api/'))return new Response('Not found',{status:404});
 return env.ASSETS.fetch(req);
}};
