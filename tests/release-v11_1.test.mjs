import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const [mobile,laptop,v108,v110,v11,sql,readme,adminEdge,tomtomEdge]=await Promise.all([
  readFile(new URL('mobile.html',root),'utf8'),readFile(new URL('laptop.html',root),'utf8'),
  readFile(new URL('v108.js',root),'utf8'),readFile(new URL('v110.js',root),'utf8'),
  readFile(new URL('v11.js',root),'utf8'),readFile(new URL('SUPABASE_V11_1_RELEASE.sql',root),'utf8'),
  readFile(new URL('README.md',root),'utf8'),readFile(new URL('supabase/functions/admin-users/index.ts',root),'utf8'),
  readFile(new URL('supabase/functions/tomtom-proxy/index.ts',root),'utf8')
]);

test('v11.1 modules en inline scripts zijn syntactisch geldig',()=>{
  for(const [name,source] of [['v108.js',v108],['v110.js',v110],['v11.js',v11]])new vm.Script(source,{filename:name});
  for(const [name,html] of [['mobile',mobile],['laptop',laptop]]){
    const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match=>match[1]).filter(Boolean);
    scripts.forEach((source,index)=>new vm.Script(source,{filename:`${name}-inline-${index}.js`}));
  }
});

test('gewone synchronisatie start geen herberekening van alle geplande dagen',()=>{
  assert.doesNotMatch(v110,/scheduleAllLiveRoutes/);
  assert.doesNotMatch(v110,/setTimeout\([^\n]*makeDatesLive\(plannedDates/);
  assert.match(v110,/makeDatesLive\(\[newDate\]/);
});

test('iedere route- en Supabasefase heeft een harde deadline',()=>{
  assert.match(v110,/Dagroute .* is na 45 seconden afgebroken/);
  assert.match(v110,/maximaal 45 seconden/);
  assert.match(v110,/loadPlanningFromSupabase\?\.\(\),20000/);
  assert.match(laptop,/Planning opslaan reageerde niet binnen 20 seconden/);
  assert.match(laptop,/Adrescontrole reageerde niet binnen 15 seconden/);
  assert.match(laptop,/Bezoeken indelen \$\{requestIndex\+1\} van \$\{requests\.length\}/);
  assert.match(v110,/generationBusy/);
});

test('Realtime is op laptop en iPhone begrensd tot de actieve werkruimte',()=>{
  assert.match(v11,/const filter=`user_id=eq\.\$\{workspace\(\)\}`/);
  assert.match(laptop,/const filter='user_id=eq\.'\+workspaceId/);
  for(const table of ['planning','app_day_settings','app_absences','visit_history','visit_photos'])assert.match(v11,new RegExp(`table:'${table}',filter`));
});

test('afronding is database-eerst, enkel gekoppeld en foto-idempotent',()=>{
  assert.match(laptop,/async function persistLaptopVisit/);
  assert.match(laptop,/let visitSaveBusy=false/);
  assert.equal((laptop.match(/btnSaveVisit"\)\.onclick/g)||[]).length,1);
  assert.match(laptop,/eq\('history_id',historyId\)\.eq\('file_path',path\)/);
  assert.match(mobile,/const before=\{status:v\.status/);
  assert.match(mobile,/Object\.assign\(v,before\)/);
});

test('Live Locaties-migratie is compleet en bevat een begrensde 30-minutensessie',()=>{
  for(const table of ['location_system_settings','user_location_settings','user_live_locations','user_location_history'])assert.match(sql,new RegExp(`table if not exists public\\.${table}`));
  for(const fn of ['set_my_location_preference','save_my_live_location','set_location_system_config','set_user_location_enabled','set_user_live_tracking','get_admin_live_locations','get_admin_location_history'])assert.match(sql,new RegExp(`function public\\.${fn}`));
  assert.match(sql,/p_minutes not between 1 and 30/);
  assert.match(v108,/trackingUntil > Date\.now\(\) \? 1/);
  assert.match(v108,/Date\.now\(\) >= trackingUntil.*restartLocationTimer/);
  assert.match(v108,/SUPABASE_V11_1_RELEASE\.sql/);
  assert.match(readme,/iOS kan door iOS worden gepauzeerd/);
});

test('mobiele totalen gebruiken uitsluitend het centrale huis-tot-huis-dagtotaal',()=>{
  assert.match(mobile,/live\?\.includesReturn&&Number\.isFinite/);
  assert.doesNotMatch(mobile,/Number\(v\.travel\|\|0\)-\(v\.mode==='walk'\?0:15\)/);
  assert.match(mobile,/return \{km:NaN,min:NaN,live:false\}/);
});

test('oude DEV-module wordt niet meer geladen en releasecache is vernieuwd',()=>{
  assert.doesNotMatch(mobile,/src="v111\.js/);
  assert.doesNotMatch(laptop,/src="v111\.js/);
  assert.match(mobile,/maximum-scale=1,user-scalable=no/);
});

test('serverfuncties rollen onvolledige accounts terug en begrenzen externe verzoeken',()=>{
  assert.match(adminEdge,/deleteUser\(data\.user\.id\)/);
  assert.match(adminEdge,/body\.action === 'delete'/);
  assert.match(adminEdge,/targetProfile\.role === 'admin'/);
  assert.match(tomtomEdge,/query\.length > 250/);
  assert.match(tomtomEdge,/TomTom-geocodering reageerde niet binnen 15 seconden/);
  assert.match(laptop,/adminDeleteUser/);
  assert.match(mobile,/mDeleteUser/);
});
