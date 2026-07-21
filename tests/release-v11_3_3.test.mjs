import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('iPhone-PDF gebruikt de afgeschermde mobiele state en niet de laptopvariabele db',()=>{
  const pdfIntegration=read('v110.js');
  assert.match(pdfIntegration,/function appState\(\)[\s\S]*?window\.GJ_MOBILE\?\.state\?\.\(\)/);
  assert.match(pdfIntegration,/function localHistory\(ref\)\{const state=appState\(\)/);
  assert.match(pdfIntegration,/function localCustomer\(id\)[\s\S]*?const state=appState\(\)/);
});

test('iPhone Historie toont een PDF-knop op de kaart en in het detailvenster',()=>{
  const integration=read('v11.js');
  assert.match(integration,/class="visitPdfBtn secondary" data-id="\$\{esc\(row\.id\)\}">PDF<\/button>/);
  assert.match(integration,/class="visitPdfBtn secondary" data-id="\$\{esc\(row\.id\)\}">PDF maken<\/button>/);
  assert.match(read('mobile.html'),/v110\.js\?v=113500/);
});

test('v11.3.8 vernieuwt de iPhone-cache',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'11.3.8');
  assert.match(read('service-worker.js'),/planyx-shell-v11\.3\.8-r1/);
  assert.match(read('mobile.html'),/window\.__GJ_APP_VERSION__='11\.3\.8'/);
});
