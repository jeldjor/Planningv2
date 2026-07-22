import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Planyx staat compact boven Welkom op het inlogscherm',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'11.3.8');
  for(const file of ['index.html','laptop.html','mobile.html'])assert.match(read(file),/<title>Planyx<\/title>/);
  const auth=read('auth.js');
  assert.match(auth,/planyx-login-transparent\.png\?v=113800-login3/);
  assert.match(auth,/nl:\['Welkom'/);
  assert.doesNotMatch(auth,/Welkom terug/);
  assert.match(auth,/\.gjLogo\{[^}]*width:min\(288px,74vw\)[^}]*max-height:30vh/);
  assert.match(read('mobile.html'),/id="splash"[\s\S]*POWERED BY[\s\S]*gj-motion-brand\.png\?v=113800-login/);
});

test('GJ Motion vervangt het oude bedrijfslogo in beide menu’s',()=>{
  const mobile=read('mobile.html'),laptop=read('laptop.html'),brand=read('brand.css');
  assert.match(mobile,/class="menuBrand"[\s\S]*gj-motion-brand\.png\?v=113800/);
  assert.match(laptop,/brand\.css\?v=113800(?:-ui[234])?/);
  assert.match(brand,/\.productBrand \.productCard img[\s\S]*gj-motion-brand\.png\?v=113800/);
  assert.match(brand,/\.splash\{[\s\S]*radial-gradient\(circle at 50% 12%,#0a315a 0%,#03152c 46%,#020a18 100%\)/);
  assert.doesNotMatch(mobile.match(/class="menuBrand"[\s\S]*?<\/div>/)?.[0]||'',/logo-menu\.png/);
});

test('inloggen en menu gebruiken de rustige vormgeving zonder losse witte of uitlogkaart',()=>{
  const auth=read('auth.js'),brand=read('brand.css');
  assert.match(auth,/#gjAuthCard\{[^}]*background:transparent[^}]*box-shadow:none/);
  assert.match(brand,/\.menuPanel \.menuLogout\{[^}]*background:transparent!important;[^}]*border-color:transparent!important;/s);
  assert.match(brand,/button\.removePlan,[\s\S]*background:#8f1d1d!important;[\s\S]*color:#d9e0e8!important;/);
});

test('nieuwe merkbestanden worden gebouwd en veilig opnieuw gecachet',()=>{
  const build=read('scripts/prepare-dist.mjs'),worker=read('service-worker.js');
  for(const asset of ['brand.css','planyx-brand.jpeg','planyx-login-transparent.png','gj-motion-brand.png']){
    assert.ok(fs.existsSync(path.join(root,asset)));
    assert.match(build,new RegExp(asset.replace('.','\\.')));
    assert.match(worker,new RegExp(asset.replace('.','\\.')));
  }
  assert.match(worker,/planyx-shell-v11\.3\.8-r1/);
  assert.match(worker,/planning-gjsystems-shell-/);
});

test('de merkrelease verandert de afgesproken PDF-footer niet',()=>{
  assert.match(read('visit-pdf.js'),/doc\.text\('GJsystems',14,pageH-8\)/);
});
