import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';

const root=new URL('../',import.meta.url),require=createRequire(import.meta.url),core=require('../planning-core.js');
const [courier,css,auth,laptop,mobile,sql,build,worker,locations]=await Promise.all([
  readFile(new URL('courier.js',root),'utf8'),readFile(new URL('courier.css',root),'utf8'),
  readFile(new URL('auth.js',root),'utf8'),readFile(new URL('laptop.html',root),'utf8'),
  readFile(new URL('mobile.html',root),'utf8'),readFile(new URL('SUPABASE_V11_4_6_COURIER.sql',root),'utf8'),
  readFile(new URL('scripts/prepare-dist.mjs',root),'utf8'),readFile(new URL('service-worker.js',root),'utf8'),
  readFile(new URL('v108.js',root),'utf8')
]);

test('koeriersmodule is syntactisch geldig en op laptop en iPhone geladen',()=>{
  new vm.Script(courier,{filename:'courier.js'});
  assert.match(laptop,/courier\.css\?v=114600/);assert.match(laptop,/courier\.js\?v=114600/);
  assert.match(mobile,/courier\.css\?v=114600/);assert.match(mobile,/courier\.js\?v=114600/);
  assert.match(build,/'courier\.js', 'courier\.css'/);
  assert.match(worker,/'\.\/courier\.js'/);
  assert.match(worker,/'\.\/courier\.css'/);
});

test('alleen het gekozen account krijgt de beveiligde koeriersmodus',()=>{
  assert.match(sql,/7b870312-0fd3-4d7c-add6-5bb25588f2de/);
  assert.match(sql,/app_mode='courier'/);
  assert.match(sql,/new\.app_mode := old\.app_mode/);
  assert.match(sql,/create policy courier_orders_workspace[\s\S]*auth\.uid\(\)/);
  assert.match(auth,/workspaceProfile/);
  assert.match(auth,/GJ_COURIER_MODE=workspaceProfile\?\.app_mode==='courier'/);
  assert.match(auth,/courier_orders','courier_address_corrections','courier_route_days'/);
  assert.match(courier,/profile\.app_mode!=="courier"/);
  assert.match(mobile,/if\(window\.GJ_COURIER_MODE\|\|appInitialized/);
  assert.match(locations,/if\(window\.GJ_COURIER_MODE\)return;manager\.init/);
});

test('transportexport wordt als bezorgopdracht verwerkt zonder bronfilter',()=>{
  for(const field of ['cargoid','c_id','d_name','d_phone','d_address1','d_address2','d_zipcode','d_city','delivery_date'])assert.match(courier,new RegExp(field));
  assert.match(courier,/digits\.length===9\)digits="0"\+digits/);
  assert.match(courier,/cargo\?"cargo:"\+cargo:"c:"\+cid/);
  assert.doesNotMatch(courier,/row\.koerier_user_id/);
  assert.match(sql,/unique\(user_id,external_id\)/);
});

test('echte adresvarianten en Nederlandse telefoonnummers worden correct gemapt',()=>{
  const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only',url:'https://example.test'});
  dom.window.eval(courier);
  const api=dom.window.GJCourier;
  const common={c_id:1,cargoid:10,d_name:'Test',d_phone:612345678,d_zipcode:'5211AB',d_city:'Den Bosch',d_country:'Netherlands',delivery_date:'2026-08-13'};
  const complete=api.mapExportRow({...common,d_address1:'Kerkstraat 12A',d_address2:''},0,null);
  const split=api.mapExportRow({...common,cargoid:11,d_address1:'Kerkstraat',d_address2:'12A'},1,null);
  assert.equal(complete.original_address,'Kerkstraat 12A, 5211AB, Den Bosch, NL');
  assert.equal(split.original_address,'Kerkstraat 12A, 5211AB, Den Bosch, NL');
  assert.equal(complete.recipient_phone,'0612345678');
  assert.equal(complete.delivery_date,'2026-08-13');
  const kept=api.mapExportRow({...common,d_address1:'Kerkstraat 12A',d_address2:''},0,{...complete,delivery_status:'delivered'});
  assert.equal(kept.delivery_status,'delivered');
  const exact={address:{postalCode:'5211 AB',streetName:'Kerkstraat',streetNumber:'12A'}};
  const changed={address:{postalCode:'5211 AB',streetName:'Kerkstraat',streetNumber:'12'}};
  assert.equal(api.addressMatchesTomTom(complete,exact,complete.original_address),true);
  assert.equal(api.addressMatchesTomTom(complete,changed,complete.original_address),false);
});

test('TomTom-wijziging vereist goedkeuring en correcties worden hergebruikt',()=>{
  assert.match(courier,/TomTom wil het adres aanpassen/);
  assert.match(courier,/Voorstel goedkeuren/);
  assert.match(courier,/Aanpassing controleren/);
  assert.match(courier,/Niet meenemen/);
  assert.match(courier,/courier_address_corrections/);
  assert.match(courier,/validation_status:"needs_review"/);
  assert.match(courier,/Controleer of verwijder eerst alle ongeldige adressen/);
});

test('koeriersroute gebruikt twee minuten en geen werkdag-, pauze- of openingslimiet',()=>{
  assert.match(courier,/stop=2/);
  assert.match(courier,/stopMin:selected\.length\*stop/);
  assert.doesNotMatch(courier,/maxWorkday/);
  assert.doesNotMatch(courier,/openingstijden/);
  assert.doesNotMatch(courier,/pauseEnabled/);
  assert.match(courier,/delivery_status==="pending"/);
  assert.match(courier,/data-action='delivered'/);
  assert.match(courier,/data-action='exclude'/);
});

test('65 TomTom-trajecten worden volledig in drie veilige delen verwerkt',async()=>{
  const calls=[];
  const sb={functions:{invoke:async(_name,{body})=>{
    calls.push(body.legs.length);
    return {data:{legs:body.legs.map(()=>({travelTimeInSeconds:600,lengthInMeters:5000,live:true}))},error:null};
  }}};
  const requests=Array.from({length:65},(_,index)=>({
    from:{lat:51+index*.01,lng:5},to:{lat:51+(index+1)*.01,lng:5},mode:'car'
  }));
  const result=await core.requestRouteBatch(sb,requests);
  assert.deepEqual(calls,[30,30,5]);
  assert.equal(result.length,65);
  assert.ok(result.every(leg=>leg.live===true&&leg.min===10&&leg.km===5));
});

test('koeriersroute wordt pas als volledige dag atomair opgeslagen',()=>{
  assert.match(sql,/create or replace function public\.save_courier_route/);
  assert.match(sql,/expected<>jsonb_array_length/);
  assert.match(sql,/Een bezorgopdracht bestaat niet meer/);
  assert.match(courier,/rpc\("save_courier_route"/);
});
