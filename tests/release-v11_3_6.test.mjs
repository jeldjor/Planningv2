import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Planyx is de appnaam op begin-, laptop- en iPhone-scherm',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'11.3.7');
  for(const file of ['index.html','laptop.html','mobile.html'])assert.match(read(file),/<title>Planyx<\/title>/);
  assert.match(read('auth.js'),/planyx-brand\.jpeg\?v=113700/);
  assert.match(read('mobile.html'),/id="splash"[\s\S]*planyx-brand\.jpeg\?v=113700/);
});

test('GJ Motion vervangt het oude bedrijfslogo in beide menu’s',()=>{
  const mobile=read('mobile.html'),laptop=read('laptop.html'),brand=read('brand.css');
  assert.match(mobile,/class="menuBrand"[\s\S]*gj-motion-brand\.png\?v=113700/);
  assert.match(laptop,/brand\.css\?v=113700/);
  assert.match(brand,/\.productBrand \.productCard img[\s\S]*gj-motion-brand\.png\?v=113700/);
  assert.doesNotMatch(mobile.match(/class="menuBrand"[\s\S]*?<\/div>/)?.[0]||'',/logo-menu\.png/);
});

test('nieuwe merkbestanden worden gebouwd en veilig opnieuw gecachet',()=>{
  const build=read('scripts/prepare-dist.mjs'),worker=read('service-worker.js');
  for(const asset of ['brand.css','planyx-brand.jpeg','gj-motion-brand.png']){
    assert.ok(fs.existsSync(path.join(root,asset)));
    assert.match(build,new RegExp(asset.replace('.','\\.')));
    assert.match(worker,new RegExp(asset.replace('.','\\.')));
  }
  assert.match(worker,/planyx-shell-v11\.3\.7-r1/);
  assert.match(worker,/planning-gjsystems-shell-/);
});

test('de merkrelease verandert de afgesproken PDF-footer niet',()=>{
  assert.match(read('visit-pdf.js'),/doc\.text\('GJsystems',14,pageH-8\)/);
});
