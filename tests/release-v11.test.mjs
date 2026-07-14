import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const core=require('../planning-core.js');
const [mobile,laptop,auth,app,css,legacyLocation,sql,baseline,edge,serviceWorker,buildScript,pkg]=await Promise.all([
  readFile(new URL('../mobile.html',import.meta.url),'utf8'),
  readFile(new URL('../laptop.html',import.meta.url),'utf8'),
  readFile(new URL('../auth.js',import.meta.url),'utf8'),
  readFile(new URL('../v11.js',import.meta.url),'utf8'),
  readFile(new URL('../v11.css',import.meta.url),'utf8'),
  readFile(new URL('../v108.js',import.meta.url),'utf8'),
  readFile(new URL('../SUPABASE_V11_0_CORE.sql',import.meta.url),'utf8'),
  readFile(new URL('../SUPABASE_V10_7_DEV_BASELINE.sql',import.meta.url),'utf8'),
  readFile(new URL('../supabase/functions/tomtom-proxy/index.ts',import.meta.url),'utf8'),
  readFile(new URL('../service-worker.js',import.meta.url),'utf8'),
  readFile(new URL('../scripts/prepare-dist.mjs',import.meta.url),'utf8'),
  readFile(new URL('../package.json',import.meta.url),'utf8')
]);

test('v11-productiebestanden zijn syntactisch geldig en op beide apparaten geladen',()=>{
  new vm.Script(app,{filename:'v11.js'});
  assert.equal(JSON.parse(pkg).version,'11.1.3');
  for(const html of [mobile,laptop]){
    assert.match(html,/planning-core\.js\?v=111003/);
    assert.match(html,/v11\.css\?v=111003/);
    assert.match(html,/v11\.js\?v=111003/);
  }
});

test('dagengine telt huis-klanten-huis en schuift werk volledig voorbij afwezigheid',()=>{
  const result=core.buildDay({
    date:'2026-07-15',departure:'08:00',parkingMinutes:15,
    visits:[{id:'a',duration:30},{id:'b',duration:30}],
    absences:[{start_date:'2026-07-15',end_date:'2026-07-15',start_time:'10:00',end_time:'11:00',type:'Training'}],
    legs:[{min:60,km:50,mode:'car',live:true},{min:30,km:20,mode:'car',live:true},{min:20,km:15,mode:'car',live:true}]
  });
  assert.equal(result.departure,'11:00');
  assert.equal(result.rows[0].start,'12:15');
  assert.equal(result.rows[1].start,'14:00');
  assert.equal(result.end,'14:50');
  assert.equal(result.totals.km,85);
  assert.equal(result.totals.travelMin,110);
  assert.equal(result.live,true);
  assert.deepEqual(result.returnLeg,{travelMin:20,distanceKm:15,routeLive:true});
});

test('route-optimalisatie behoudt alle bezoeken en kiest een kortere volgorde',()=>{
  const home={lat:0,lng:0},visits=[
    {id:'ver',customer:{lat:0,lng:3}},
    {id:'dichtbij',customer:{lat:0,lng:1}},
    {id:'midden',customer:{lat:0,lng:2}}
  ];
  const optimized=core.optimizeVisits(visits,home);
  assert.deepEqual(optimized.map(v=>v.id),['dichtbij','midden','ver']);
  assert.deepEqual(new Set(optimized.map(v=>v.id)),new Set(visits.map(v=>v.id)));
});

test('live route gebruikt één complete batch en accepteert geen gedeeltelijk antwoord',async()=>{
  let calls=0;
  const ok={
    functions:{
      invoke:async()=>{
        calls++;
        return{data:{legs:[{travelTimeInSeconds:600,lengthInMeters:12000,live:true},{travelTimeInSeconds:900,lengthInMeters:18000,live:true}]},error:null};
      }
    }
  };
  const requests=[{from:{lat:1,lng:1},to:{lat:2,lng:2},mode:'car'},{from:{lat:2,lng:2},to:{lat:1,lng:1},mode:'car'}];
  const legs=await core.requestRouteBatch(ok,requests);assert.equal(calls,1);assert.equal(legs.length,2);assert.equal(legs[0].km,12);
  const partial={functions:{invoke:async()=>({data:{legs:[{travelTimeInSeconds:600,lengthInMeters:12000,live:true}]},error:null})}};
  await assert.rejects(()=>core.requestRouteBatch(partial,requests),/geen complete dagroute/);
});

test('oude TomTom Edge Function valt terug op losse live trajecten',async()=>{
  let calls=0;
  const legacy={functions:{invoke:async(_name,{body})=>{
    calls++;
    if(body.action==='route-batch')return{data:null,error:{message:'Edge Function returned a non-2xx status code',context:new Response(JSON.stringify({error:'Onbekende actie.'}),{status:400})}};
    return{data:{routes:[{summary:{travelTimeInSeconds:300,lengthInMeters:4000,live:true}}]},error:null};
  }}};
  const requests=[{from:{lat:1,lng:1},to:{lat:2,lng:2},mode:'car'},{from:{lat:2,lng:2},to:{lat:1,lng:1},mode:'car'}];
  const legs=await core.requestRouteBatch(legacy,requests);
  assert.equal(calls,3);
  assert.deepEqual(legs.map(leg=>leg.km),[4,4]);
  const detail=await core.functionErrorMessage({error:{message:'generic',context:new Response(JSON.stringify({error:'TomTom staat uit.'}),{status:503})}});
  assert.equal(detail,'TomTom staat uit.');
});

test('harde deadline beëindigt een vastgelopen netwerkbewerking',async()=>{
  const never=new Promise(()=>{});
  await assert.rejects(()=>core.withTimeout(never,10,'deadline bereikt'),/deadline bereikt/);
});

test('mobiele volgorde, tijden, uit-planning en pauze schrijven centraal',()=>{
  assert.match(mobile,/async function saveVisitOrderToSupabase/);
  assert.match(mobile,/vs\.forEach\(\(v,idx\)=>v\.order=idx\+1\);renderAll\(\);await recalculateMobileDayRoute\(todayIso\(\),false\)/);
  assert.match(mobile,/removeFromPlanning\(id\)/);
  assert.match(mobile,/status:'Uit planning'/);
  assert.match(mobile,/saveTime\(id,start,end\)/);
  assert.match(mobile,/fixed_starttijd:v\.time/);
  assert.match(mobile,/bezoekduur_min:durationOf\(v\),route_live:false/);
  assert.match(mobile,/togglePause\(date=todayIso\(\)\)/);
  assert.match(mobile,/recalculateMobileDayRoute\(date,optimize=false\)/);
});

test('overzicht, mobiele historie en niet-uitgevoerd kopiëren zijn aanwezig',()=>{
  assert.match(mobile,/id="historyMobile"/);
  assert.match(app,/openStatuses=new Set\(\['Gepland','Vast','Ingepland'\]\)/);
  assert.match(app,/Naar vandaag verplaatsen/);
  assert.match(app,/signedPhotoUrl/);
  assert.match(app,/replan_history_visit/);
  assert.match(sql,/rescheduled_from_history_id/);
  assert.match(sql,/De oorspronkelijke historie is ongewijzigd|source public\.visit_history/);
  assert.match(mobile,/class="visitPdfBtn secondary"/);
  assert.match(mobile,/>PDF<\/button>/);
});

test('beveiliging bewaart geen wachtwoord en gebruikt private foto-buckets',()=>{
  assert.doesNotMatch(auth,/JSON\.stringify\(\{remember:true,email,password\}\)/);
  assert.match(auth,/Het wachtwoord wordt nooit opgeslagen/);
  assert.match(sql,/update storage\.buckets set public=false/);
  assert.match(sql,/visit photos private read/);
  assert.doesNotMatch(mobile,/getPublicUrl\(/);
  assert.doesNotMatch(laptop,/getPublicUrl\(/);
});

test('Supabase-routeopslag is één gecontroleerde dagmutatie',()=>{
  assert.match(sql,/function public\.save_day_route/);
  assert.match(sql,/security invoker/);
  assert.match(sql,/De dagplanning is intussen gewijzigd/);
  assert.match(sql,/route_revision=route_revision\+1/);
  assert.match(sql,/revoke all on function public\.save_day_route/);
  assert.match(edge,/body\.action === 'route-batch'/);
  assert.match(edge,/legs\.length > 30/);
  assert.match(sql,/function public\.move_planning_day/);
  assert.match(sql,/De nieuwe dag bevat al geplande bezoeken/);
  assert.doesNotMatch(core.persistDay.toString(),/\.from\('planning'\)\.update/);
  assert.match(core.persistDay.toString(),/centrale routeopslag ontbreekt/);
  for(const functionName of ['save_user_app_settings','save_day_route','replan_history_visit','move_planning_day']){
    assert.match(baseline,new RegExp(`function public\\.${functionName}`));
  }
});

test('centrale dagengine verwerkt pauze en heeft geen hardgecodeerde woonlocatie',()=>{
  const result=core.buildDay({date:'2026-07-15',departure:'11:00',parkingMinutes:0,pauseEnabled:true,pauseMinutes:30,visits:[{id:'a',duration:30},{id:'b',duration:30}],legs:[{min:20,km:10,mode:'car',live:true},{min:20,km:10,mode:'car',live:true},{min:20,km:10,mode:'car',live:true}]});
  assert.equal(result.totals.pauseMin,30);
  assert.equal(result.rows[1].start,'12:40');
  assert.doesNotMatch(laptop,/startLat\?\?51\.6889|startLng\?\?5\.3039/);
  assert.doesNotMatch(mobile,/Neerstraat 1, Den Bosch/);
});

test('datumperioden en ontwikkellabels zijn opgeschoond',()=>{
  assert.match(laptop,/id="dateFilterFrom"/);
  assert.match(laptop,/id="dateFilterTo"/);
  assert.match(laptop,/id="historyDateFrom"/);
  assert.match(laptop,/id="historyDateTo"/);
  assert.match(css,/\.version,.productVersion,.settingsVersion/);
  assert.doesNotMatch(mobile,/<div class="version">/);
  assert.doesNotMatch(laptop,/<div class="productVersion">/);
  assert.doesNotMatch(legacyLocation,/Development \/ test/);
});

test('app-shellcache bewaart geen runtimeconfig of Supabase-data',()=>{
  assert.match(serviceWorker,/runtime-config\.js/);
  assert.match(serviceWorker,/url\.origin!==self\.location\.origin/);
  assert.doesNotMatch(serviceWorker,/unregister\s*\(/);
  assert.doesNotMatch(serviceWorker,/supabase\.co/);
  for(const file of ['service-worker.js','planning-core.js','visit-pdf.js','v11.js','v11.css']){
    assert.match(buildScript,new RegExp(file.replace('.','\\.')));
  }
});
