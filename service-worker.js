/* Planyx v11.3.8 - veilige app-shellcache; Supabase-data wordt nooit gecachet. */
'use strict';
const CACHE='planyx-shell-v11.3.8-r1-login-ui3';
const SHELL=['./','./index.html','./laptop.html','./mobile.html','./manifest.webmanifest','./auth.js','./app-config.js','./planning-core.js','./visit-pdf.js','./photo-zip.js','./assets/chain-banners.png','./assets/chain-banners-core.png','./assets/icons/apple-touch-icon.png','./assets/icons/icon-192.png','./assets/icons/icon-512.png','./v11.js','./v11.css','./v113.js','./v113.css','./v114.js','./v114.css','./brand.css','./planyx-brand.jpeg','./gj-motion-brand.png'];

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
