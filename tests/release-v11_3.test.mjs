import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),core=require('../planning-core.js'),root=new URL('../',import.meta.url);
const [mobile,laptop,v11,v113,css,sql,pkg,worker,build]=await Promise.all([
  readFile(new URL('mobile.html',root),'utf8'),readFile(new URL('laptop.html',root),'utf8'),readFile(new URL('v11.js',root),'utf8'),
  readFile(new URL('v113.js',root),'utf8'),readFile(new URL('v113.css',root),'utf8'),readFile(new URL('SUPABASE_V11_3_RELEASE.sql',root),'utf8'),
  readFile(new URL('package.json',root),'utf8'),readFile(new URL('service-worker.js',root),'utf8'),readFile(new URL('scripts/prepare-dist.mjs',root),'utf8')
]);

test('v11.3 gebruikt een stabiele invoerhash en hergebruikt ongewijzigde groene routes',()=>{
  assert.equal(core.VERSION,'11.3.0');assert.equal(JSON.parse(pkg).version,'11.3.0');
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
  assert.match(laptop,/v113\.css\?v=113000/);assert.match(laptop,/v113\.js\?v=113000/);
  assert.match(mobile,/v113\.js\?v=113000/);assert.match(build,/'v113\.js', 'v113\.css'/);
  assert.match(worker,/planning-gjsystems-shell-v11\.3\.0/);
});
