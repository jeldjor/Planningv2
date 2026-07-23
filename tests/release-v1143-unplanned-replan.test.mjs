import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const laptop=readFileSync(new URL('../laptop.html',import.meta.url),'utf8');
const worker=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');

test('uit planning bewaart het oorspronkelijke bezoek-id',()=>{
  assert.match(laptop,/db\.unplanned\.push\(\{id:uuid\(\),sourceVisitId:v\.id,/);
});

test('zelf datum en slim plannen gebruiken dezelfde oorspronkelijke bezoekregel',()=>{
  assert.match(laptop,/function visitFromUnplanned\(uid,date,time="",duration=60\)/);
  assert.match(laptop,/const sourceId=u\.sourceVisitId\|\|u\.planningId\|\|""/);
  assert.match(laptop,/visitFromUnplanned\(p\.uid,p\.date/);
  assert.match(laptop,/visitFromUnplanned\(state\.moveUnplannedId,newDate,time,duration\)/);
  assert.doesNotMatch(laptop,/if\(state\.moveMode==="unplanned"\)\{\s*db\.visits\.push/);
});

test('Supabase werkt de uit-planningregel bij voordat een nieuwe regel wordt toegevoegd',()=>{
  assert.match(laptop,/window\.gjSyncUnplannedVisitToSupabase = async function/);
  assert.match(laptop,/\.in\('status',\['Uit planning','Niet ingepland'\]\)\s*\.is\('datum',null\)/);
  assert.match(laptop,/from\('planning'\)\.update\(patch\)\.eq\('id',targetId\)/);
  assert.match(worker,/planyx-shell-v11\.3\.8-r2-unplanned-date-persistence/);
});
