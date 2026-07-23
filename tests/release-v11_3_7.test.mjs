import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Planyx heeft een geldig standalone PWA-manifest',()=>{
  const manifest=JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name,'Planyx');
  assert.equal(manifest.short_name,'Planyx');
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.scope,'./');
  assert.match(manifest.start_url,/index\.html\?v=113800/);
  assert.deepEqual(manifest.icons.map(icon=>icon.sizes),['192x192','512x512']);
});

test('alle app-ingangen bieden PWA- en iPhone-metadata aan',()=>{
  for(const file of ['index.html','mobile.html','laptop.html']){
    const html=read(file);
    assert.match(html,/rel="manifest" href="manifest\.webmanifest\?v=113800"/);
    assert.match(html,/rel="apple-touch-icon" sizes="180x180" href="assets\/icons\/apple-touch-icon\.png\?v=113800"/);
    assert.match(html,/name="theme-color" content="#03152c"/);
  }
  assert.match(read('mobile.html'),/name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(read('mobile.html'),/name="apple-mobile-web-app-title" content="Planyx"/);
});

test('PWA-iconen worden gebouwd en door de service worker gecachet',()=>{
  const files=['assets/icons/apple-touch-icon.png','assets/icons/icon-192.png','assets/icons/icon-512.png'];
  const build=read('scripts/prepare-dist.mjs'),worker=read('service-worker.js');
  for(const file of files){
    assert.ok(fs.statSync(path.join(root,file)).size>1000,file);
    assert.ok(build.includes(file),file);
    assert.ok(worker.includes('./'+file),file);
  }
  assert.match(worker,/planyx-shell-v11\.3\.8-r2/);
  assert.match(read('v11.js'),/updateViaCache:'none'/);
});
