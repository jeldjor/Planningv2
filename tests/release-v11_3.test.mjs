import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),core=require('../planning-core.js'),root=new URL('../',import.meta.url);
const [mobile,laptop,v11,v110,v113,css,pdf,sql,sql131,pkg,worker,build]=await Promise.all([
  readFile(new URL('mobile.html',root),'utf8'),readFile(new URL('laptop.html',root),'utf8'),readFile(new URL('v11.js',root),'utf8'),
  readFile(new URL('v110.js',root),'utf8'),readFile(new URL('v113.js',root),'utf8'),readFile(new URL('v113.css',root),'utf8'),readFile(new URL('visit-pdf.js',root),'utf8'),readFile(new URL('SUPABASE_V11_3_RELEASE.sql',root),'utf8'),readFile(new URL('SUPABASE_V11_3_1_RELEASE.sql',root),'utf8'),
  readFile(new URL('package.json',root),'utf8'),readFile(new URL('service-worker.js',root),'utf8'),readFile(new URL('scripts/prepare-dist.mjs',root),'utf8')
]);

test('v11.3 gebruikt een stabiele invoerhash en hergebruikt ongewijzigde groene routes',()=>{
  assert.equal(core.VERSION,'11.3.6');assert.equal(JSON.parse(pkg).version,'11.3.6');
  const input={date:'2026-07-16',departure:'08:30',home:{lat:51.69,lng:5.3},visits:[{id:'a',order:1,duration:30,customer:{lat:51.7,lng:5.4}}],absences:[],parkingMinutes:15,walkThresholdMeters:300,pauseEnabled:true};
  const hash=core.routeInputHash(input);
  assert.equal(hash,core.routeInputHash(input));
  assert.equal(core.canReuseDayRoute({live:true,includesReturn:true,returnLeg:{routeLive:true},inputHash:hash},hash),true);
  assert.equal(core.canReuseDayRoute({live:true,includesReturn:true,returnLeg:{routeLive:true},inputHash:hash},core.routeInputHash({...input,departure:'09:00'})),false);
  assert.match(v11,/canReuseDayRoute\(current,inputHash\)/);
});

test('laptop toont trajectstatus uit opgeslagen planning en terugrit uit centrale dagstatus',()=>{
  assert.match(laptop,/function storedVisitRoute\(v,fallback\)/);
  assert.match(laptop,/v\?\.route_live===true\|\|v\?\.routeLive===true/);
  assert.match(laptop,/function storedReturnRoute\(date,fallback\)/);
  assert.match(laptop,/db\.routeStats\?\.\[date\]\?\.returnLeg/);
  assert.doesNotMatch(laptop,/if\(hadStale\)\{db\.routeCache=\{\};db\.routeStats=\{\};\}/);
  assert.match(v113,/loadAuthoritativeDaySettings/);
});

test('afronden gebruikt op laptop en iPhone uitsluitend de atomaire Supabase-RPC',()=>{
  assert.match(laptop,/rpc\('complete_visit'/);assert.match(mobile,/rpc\('complete_visit'/);
  assert.doesNotMatch(laptop,/const row=\{customer_id:v\.customerId,planning_id:planningId/);
  assert.doesNotMatch(mobile,/const historyRow=\{customer_id:v\.customerId/);
  assert.match(sql,/select \* into planned[\s\S]*where id=p_planning_id and user_id=target[\s\S]*for update/);
  assert.match(sql,/customer_id=planned\.customer_id/);
  assert.match(sql,/visit_history_one_per_planning_idx/);
});

test('database heeft locatiebolletjes, actieve filters en importcontrole vóór upload',()=>{
  assert.match(v113,/data-db-filter="all"/);assert.match(v113,/data-db-filter="active"/);assert.match(v113,/data-db-filter="inactive"/);
  assert.match(v113,/validCoordsForCustomer/);assert.match(v113,/validateCustomerLocations/);assert.match(v113,/geocodeCustomer/);
  assert.match(v113,/Import gepauzeerd/);assert.match(v113,/meenemen_in_planning:active/);
  assert.match(css,/v113LocationDot\.valid/);assert.match(css,/v113LocationDot\.auto/);assert.match(css,/v113LocationDot\.invalid/);
});

test('datumvelden blijven compact naast elkaar en release-assets worden gedeployed',()=>{
  assert.match(v113,/v113CompactDates/);assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(laptop,/v113\.css\?v=113001/);assert.match(laptop,/v113\.js\?v=113500/);
  assert.match(mobile,/v113\.js\?v=113500/);assert.match(build,/'v113\.js', 'v113\.css'/);
  assert.match(worker,/planyx-shell-v11\.3\.6-r1/);
});

test('grote bezoekfoto’s worden vóór laptop- en iPhone-upload veilig verkleind',async()=>{
  const small={type:'image/jpeg',size:1024,name:'klein.jpg'};
  assert.equal(await core.prepareVisitPhoto(small),small);
  assert.match(String(core.prepareVisitPhoto),/8\*1024\*1024/);
  assert.match(String(core.prepareVisitPhoto),/maxDimension=2560/);
  assert.match(laptop,/GJPlanningCore\.prepareVisitPhoto\(originalFile\)/);
  assert.match(mobile,/prepareVisitPhoto\(originalFile\)/);
  assert.match(laptop,/originalFile\.name,originalFile\.size,originalFile\.lastModified,originalFile\.type/);
  assert.match(mobile,/photoFingerprint\(originalFile\)/);
});

test('volgordewijzigingen respecteren opening en sluiting op laptop en iPhone',()=>{
  assert.deepEqual(core.openingWindowForDate({tekst:'Ma-Za 10:00-18:00; Zo gesloten'},'2026-07-15'),{open:'10:00',close:'18:00',closed:false});
  assert.deepEqual(core.openingWindowForDate({tekst:'Ma-Za 10:00-18:00; Zo gesloten'},'2026-07-19'),{open:'',close:'',closed:true});
  const early=core.buildDay({date:'2026-07-15',departure:'08:00',parkingMinutes:0,pauseEnabled:false,visits:[{id:'a',duration:30,customer:{name:'Testwinkel',opening:{tekst:'Ma-Za 10:00-18:00'}}}],legs:[{min:30,km:10,mode:'car',live:true},{min:20,km:10,mode:'car',live:true}]});
  assert.equal(early.rows[0].start,'10:00');assert.equal(early.rows[0].end,'10:30');assert.equal(early.rows[0].waitingMin,90);
  assert.throws(()=>core.buildDay({date:'2026-07-15',departure:'17:30',parkingMinutes:0,pauseEnabled:false,visits:[{id:'a',duration:30,customer:{name:'Testwinkel',opening:{tekst:'Ma-Za 10:00-18:00'}}}],legs:[{min:20,km:10,mode:'car',live:true},{min:20,km:10,mode:'car',live:true}]}),/past niet vóór sluitingstijd 18:00/);
  assert.match(laptop,/routeOpeningTime\(c,date\)/);assert.match(mobile,/openingWindowForDate\(c\.opening,v\.date\)/);
  assert.match(mobile,/const original=new Map\(vs\.map\(v=>\[v\.id,v\.order\]\)\)/);
  assert.match(v11,/opening:customer\?\.Openingstijden/);
  assert.match(mobile,/Wachttijd/);assert.match(mobile,/visit\.waiting=row\.waitingMin/);
  assert.match(String(core.persistDay),/visitWaits/);
});

test('iPhone-wachttijd wordt per bezoek berekend en centraal herlaadbaar opgeslagen',async()=>{
  const result=core.buildDay({date:'2026-07-15',departure:'08:00',parkingMinutes:0,pauseEnabled:false,visits:[{id:'a',duration:30,customer:{name:'Testwinkel',opening:{tekst:'Ma-Za 10:00-18:00'}}}],legs:[{min:30,km:10,mode:'car',live:true},{min:20,km:10,mode:'car',live:true}]});
  let payload=null;
  const summary=await core.persistDay({rpc:async(name,args)=>{assert.equal(name,'save_day_route');payload=args;return{data:{changed:1},error:null}}},{workspaceId:'00000000-0000-0000-0000-000000000001',date:'2026-07-15',departure:'08:00',result,pauseEnabled:false,inputHash:'test-hash'});
  assert.equal(result.rows[0].waitingMin,90);
  assert.equal(summary.visitWaits.a,90);
  assert.equal(payload.p_summary.visitWaits.a,90);
  assert.match(mobile,/day_route\?\.visitWaits/);
  assert.match(v11,/route\.visitWaits/);
});

test('uitvoeringsdatum kan zonder dubbele historie op laptop en iPhone worden aangepast',()=>{
  assert.match(sql131,/create or replace function public\.update_visit_history/);
  assert.match(sql131,/security invoker/);assert.match(sql131,/where id=p_history_id and user_id=target/);
  assert.match(sql131,/grant execute on function public\.update_visit_history/);
  assert.match(laptop,/rpc\('update_visit_history'/);assert.match(mobile,/rpc\('update_visit_history'/);
  assert.match(laptop,/visitExecutionDate/);assert.match(mobile,/finishExecutionDate/);
});

test('iPhone heeft één fotokiezer en kan nieuwe en opgeslagen bezoekfoto’s verwijderen',()=>{
  assert.match(mobile,/id="btnChoosePhoto"[^>]*>🖼 Kies foto/);
  assert.match(mobile,/id="btnTakePhoto"[^>]*>🗑 Foto verwijderen/);
  assert.doesNotMatch(mobile,/btnTakePhoto'\)\.onclick=\(\)=>\$\('finishCamera'\)\.click/);
  assert.match(mobile,/storage\.from\('visit-photos'\)\.remove\(\[photo\.path\]\)/);
  assert.match(mobile,/from\('visit_photos'\)\.delete\(\)\.eq\('history_id',historyId\)/);
});

test('PDF-foto’s worden rechtop genormaliseerd en bezoekrapport toont geen tijden',()=>{
  assert.match(v110,/createImageBitmap\(blob,\{imageOrientation:'from-image'\}\)/);
  assert.match(v110,/canvas\.toDataURL\('image\/jpeg',\.9\)/);
  assert.match(v110,/prepareReportAssets\(rawReport\)/);
  assert.doesNotMatch(pdf,/\['Starttijd'/);assert.doesNotMatch(pdf,/\['Eindtijd'/);
});

test('acht goedgekeurde ketenbanners worden herkend en meegebouwd',async()=>{
  for(const key of ['van_haren','bomont','daka','e5','molecule','torfs','veritas','berden'])assert.match(pdf,new RegExp(`${key}:\\{displayName:`));
  assert.match(pdf,/assets\/chain-banners\.png/);assert.match(build,/'assets\/chain-banners\.png'/);assert.match(worker,/assets\/chain-banners\.png/);
  assert.ok((await stat(new URL('assets/chain-banners.png',root))).size>100000);
});

test('iPhone-afwezigheid ondersteunt dezelfde dag, wijzigen, verwijderen en routeherberekening',()=>{
  assert.match(mobile,/\$\('blockEnd'\)\.value=todayIso\(\)/);
  assert.doesNotMatch(mobile,/\$\('blockEnd'\)\.value=addDaysIso\(todayIso\(\),1\)/);
  assert.match(mobile,/function editAbsence\(id\)/);assert.match(mobile,/async function deleteAbsence\(id\)/);
  assert.match(mobile,/from\('app_absences'\)\.update/);assert.match(mobile,/from\('app_absences'\)\.delete\(\)/);
  assert.match(mobile,/await recalculateAbsenceDates\(\[previous,savedBlock\]\.filter\(Boolean\)\)/);
  assert.match(mobile,/await recalculateAbsenceDates\(\[block\]\)/);
  assert.match(mobile,/De eindtijd moet later zijn dan de starttijd/);
});

test('historie toont gekoppelde klantnaam en ongeldige toekomstige eindstatus wordt geblokkeerd',()=>{
  assert.match(v11,/customer:customers!visit_history_customer_id_fkey\(naam,keten,plaats,klantnummer\)/);
  assert.match(v11,/customerName:related\.naam\|\|local\.name\|\|'Klant'/);
  assert.match(laptop,/customerName:related\.naam\|\|customer\.Winkel/);
  assert.match(sql131,/update public\.planning p set[\s\S]*status='Gepland'[\s\S]*not exists/);
  assert.match(sql131,/create constraint trigger planning_completed_requires_history/);
  assert.match(sql131,/deferrable initially deferred/);
  assert.match(sql131,/Een opdracht kan alleen via Bezoek afronden op uitgevoerd worden gezet/);
  assert.match(laptop,/const planningStatus=v\.status==='Vast'\?'Vast':'Gepland'/);
});
