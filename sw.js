// Preserve manifest identity and scope. Never cache authenticated data or force reload.
const APP_URL = new URL('./', self.location.href);
self.addEventListener('push', event => {
  let data = {title:'OKGU DIARY',body:'새 알림이 있어요.',url:APP_URL.href};
  try { if(event.data) data = {...data,...event.data.json()}; } catch {}
  let target = new URL(data.url || APP_URL.href,APP_URL);
  if(target.origin!==APP_URL.origin || !target.pathname.startsWith(APP_URL.pathname)) target=APP_URL;
  const tasks=[self.registration.showNotification(data.title || 'OKGU DIARY', {
    body:data.body||'새 알림이 있어요.',icon:'okgu_icon.png',badge:'okgu_icon.png',
    tag:data.tag||'okgu-diary',data:{url:target.href}
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
