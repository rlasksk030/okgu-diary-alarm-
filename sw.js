// Praise release v20261005. Claim open legacy pages without reloading their drafts.
const APP_URL = new URL('./', self.location.href);
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async()=>{
  // Only this app's asset entries; never clear IndexedDB, localStorage or subscriptions.
  for(const name of await caches.keys()){
    const cache=await caches.open(name);
    for(const request of await cache.keys()){
      const url=new URL(request.url);
      if(url.origin===APP_URL.origin&&url.pathname.startsWith(APP_URL.pathname))await cache.delete(request);
    }
  }
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url=new URL(event.request.url);
  if(url.hostname==='script.google.com'||url.hostname==='script.googleusercontent.com'){
    // Old Pages use JSONP GET even for saveEntry. Reject before any network I/O.
    const message='앱이 업데이트되었어요. 아직 저장되지 않았습니다. 작성한 글과 사진을 보관한 뒤 같은 앱 주소를 다시 열고 로그인해 주세요.';
    const callback=url.searchParams.get('callback');
    if(event.request.destination==='script'&&/^__jp\d+_\d+$/.test(callback||'')){
      event.respondWith(new Response(callback+'('+JSON.stringify({ok:false,error:message})+');',{
        headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'}
      }));
    }else event.respondWith(new Response(JSON.stringify({success:false,code:'E_CLOUD_REQUIRED',msg:message}),{
      status:409,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
    }));
    return;
  }
  if(url.origin===APP_URL.origin&&url.pathname.startsWith(APP_URL.pathname)){
    // Never serve the old HTML/config/JS from an HTTP or service-worker cache.
    if(event.request.mode==='navigate'||/\.(?:js|html)$/.test(url.pathname))event.respondWith(fetch(event.request,{cache:'no-store'}));
  }else if(url.hostname.endsWith('.workers.dev')&&url.pathname.startsWith('/api/')){
    event.respondWith(fetch(event.request,{cache:'no-store'}));
  }
});
self.addEventListener('push', event => {
  let data = {title:'OKGU DIARY',body:'새 알림이 있어요.',url:APP_URL.href};
  try { if(event.data) data = {...data,...event.data.json()}; } catch {}
  let target = new URL(data.url || APP_URL.href,APP_URL);
  if(target.origin!==APP_URL.origin || !target.pathname.startsWith(APP_URL.pathname)) target=APP_URL;
  const tasks=[self.registration.showNotification(data.title || 'OKGU DIARY', {
    body:data.body||'새 알림이 있어요.',icon:'okgu_icon.png',badge:'okgu_icon.png',
    tag:data.tag||'okgu-diary',data:{url:target.href,
      ...Object.fromEntries(['entryId','studentId','classId']
        .filter(key=>typeof data[key]==='string'&&data[key].length<=128)
        .map(key=>[key,data[key]]))}
  })];
  if(self.registration.setAppBadge)tasks.push(self.registration.setAppBadge(Math.max(1,Number(data.badgeCount)||1)).catch(()=>{}));
  event.waitUntil(Promise.all(tasks));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 let url=new URL(event.notification.data?.url||APP_URL.href,APP_URL);
 if(url.origin!==APP_URL.origin||!url.pathname.startsWith(APP_URL.pathname))url=APP_URL;
 event.waitUntil((async()=>{
  if(self.registration.clearAppBadge)await self.registration.clearAppBadge().catch(()=>{});
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const client=clients.find(c=>{const u=new URL(c.url);return u.origin===APP_URL.origin&&u.pathname.startsWith(APP_URL.pathname);});
  if(client){client.postMessage({type:'OKGU_DEEP_LINK',url:url.href});return client.focus();}
  if(self.clients.openWindow)return self.clients.openWindow(url.href);
 })());
});
