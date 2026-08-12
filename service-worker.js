/* Planyx v11.4.6 - veilige app-shellcache; Supabase-data wordt nooit gecachet. */
'use strict';
const CACHE='planyx-shell-v11.4.6-courier-r4';
const SHELL=['./','./index.html','./laptop.html','./mobile.html','./manifest.webmanifest','./auth.js','./auth.js?v=114600','./app-config.js','./planning-core.js','./planning-core.js?v=114600','./courier.js','./courier.js?v=114603','./courier.css','./courier.css?v=114603','./visit-pdf.js','./photo-zip.js','./assets/chain-banners.png','./assets/chain-banners-core.png','./assets/icons/apple-touch-icon.png','./assets/icons/icon-192.png','./assets/icons/icon-512.png','./v108.js?v=114600','./v11.js','./v11.js?v=114600','./v11.css','./v113.js','./v113.js?v=114600','./v113.css','./v114.js','./v114.css','./brand.css','./planyx-brand.jpeg','./planyx-login-transparent.png','./gj-motion-brand.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('planning-gjsystems-shell-')||key.startsWith('planyx-shell-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==self.location.origin||url.pathname.endsWith('/runtime-config.js'))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));return response}).catch(()=>caches.match(request).then(hit=>hit||caches.match('./index.html'))));return;
  }
  event.respondWith(caches.match(request).then(hit=>{
    const fresh=fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response}).catch(()=>hit);
    return hit||fresh;
  }));
});
