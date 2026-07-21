import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const pdf=read('visit-pdf.js'),build=read('scripts/prepare-dist.mjs'),worker=read('service-worker.js');

test('alle dertien bekende ketens hebben een winkelbanner',()=>{
  for(const key of ['bijenkorf','scapino','inno','intersport','van_tilburg_sport','van_haren','bomont','daka','e5','molecule','torfs','veritas','berden']){
    assert.match(pdf,new RegExp(`${key}:\\{displayName:[\\s\\S]*?banner:\\{`));
  }
  assert.match(pdf,/assets\/chain-banners-core\.png/);
  assert.ok(fs.statSync(path.join(root,'assets/chain-banners-core.png')).size>1_000_000);
});

test('ketenbanner staat onvervormd over de volledige paginabreedte',()=>{
  assert.match(pdf,/bannerRatio=Number\(profile\.banner\?\.w\)\/Number\(profile\.banner\?\.h\)/);
  assert.match(pdf,/headerH=report\.bannerImage\?Math\.max\(20,Math\.min\(48,pageW\/bannerRatio\)\):44/);
  assert.match(pdf,/doc\.addImage\(report\.bannerImage,'JPEG',0,0,pageW,headerH/);
  assert.doesNotMatch(pdf,/rightX=140|leftW=140/);
});

test("PDF-foto's blijven binnen hun kader en raken tekst niet",()=>{
  assert.doesNotMatch(pdf,/doc\.clip\(/);
  assert.match(pdf,/photo\?\.pdfCropped/);
  assert.match(pdf,/if\(y\+blockHeight>274\)y=addPage/);
});

test('v11.3.8 bouwt en cachet beide bannerbronnen',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'11.3.8');
  assert.match(build,/'assets\/chain-banners-core\.png'/);
  assert.match(worker,/planyx-shell-v11\.3\.8-r1/);
  assert.match(worker,/\.\/assets\/chain-banners-core\.png/);
  for(const html of ['laptop.html','mobile.html']){
    assert.match(read(html),/visit-pdf\.js\?v=113500/);
    assert.match(read(html),/v110\.js\?v=113500/);
  }
});
