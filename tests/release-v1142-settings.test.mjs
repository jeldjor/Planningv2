import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const laptop=readFileSync(new URL('../laptop.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../v114.css',import.meta.url),'utf8');
const worker=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');

test('gewone gebruikers zien werkruimtebeheer onder Instellingen',()=>{
  assert.match(laptop,/id="settings"[\s\S]*id="dataManagement"[\s\S]*id="btnClearUnplanned"/);
  assert.match(laptop,/Niet ingeplande bezoeken verwijderen/);
  assert.match(laptop,/#settings #btnClearUnplanned/);
});

test('niet ingepland verwijderen bewaart klanten en andere bezoeken',()=>{
  assert.match(laptop,/action==='unplanned'[\s\S]*db\.unplanned=\[\][\s\S]*filter\(v=>!\['Uit planning','Niet ingepland'\]/);
  assert.match(laptop,/from\('planning'\)\.delete\(\)\.in\('status',\['Uit planning','Niet ingepland'\]\)/);
  assert.doesNotMatch(laptop,/action==='unplanned'\|\|action==='routes'/);
});

test('GJ Motion staat compact boven talen op één regel',()=>{
  assert.match(css,/content:url\('gj-motion-brand\.png\?v=11402'\)/);
  assert.match(css,/\.productBrand \.sidebarLang\{[\s\S]*flex-wrap:nowrap!important;[\s\S]*white-space:nowrap!important;/);
  assert.match(laptop,/class="productCard"[\s\S]*class="sidebarLang"/);
  assert.match(worker,/planyx-shell-v11\.3\.8-r2-unplanned-date-persistence/);
});
