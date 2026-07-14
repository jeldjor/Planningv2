import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';
const require=createRequire(import.meta.url),pdf=require('../visit-pdf.js');
const [script,laptop,mobile,manifestText,pkgText]=await Promise.all([
  readFile(new URL('../v110.js',import.meta.url),'utf8'),readFile(new URL('../laptop.html',import.meta.url),'utf8'),
  readFile(new URL('../mobile.html',import.meta.url),'utf8'),readFile(new URL('../output/pdf/pdf-test-manifest.json',import.meta.url),'utf8'),
  readFile(new URL('../package.json',import.meta.url),'utf8')
]);

test('v10.10 modules zijn syntactisch geldig en lokaal geladen',()=>{
  new vm.Script(script,{filename:'v110.js'});
  assert.equal(JSON.parse(pkgText).version,'11.1.2');
  for(const html of [laptop,mobile]){
    assert.match(html,/vendor\/jspdf\.umd\.min\.js\?v=251/);assert.match(html,/visit-pdf\.js\?v=11000/);assert.match(html,/v110\.js\?v=11001/);
    assert.doesNotMatch(html,/cdn\.jsdelivr\.net\/npm\/jspdf/);
  }
});

test('ketenherkenning gebruikt het centrale ketenprofiel en veilige fallback',()=>{
  assert.equal(pdf.resolveChainProfile('Intersport').key,'intersport');
  assert.equal(pdf.resolveChainProfile('INTERSPORT Nederland').key,'intersport');
  assert.equal(pdf.resolveChainProfile('de Bijenkorf').key,'bijenkorf');
  assert.equal(pdf.resolveChainProfile('Van Tilburg Sport').key,'van_tilburg_sport');
  assert.equal(pdf.resolveChainProfile('Niet bekende winkelgroep').key,'stichd');
  assert.equal(pdf.resolveChainProfile('').key,'stichd');
});

test('lege PDF-velden en ontbrekende foto-inhoud worden niet gerenderd',()=>{
  const details=pdf.buildDetailFields({storeName:'Test',city:'Eindhoven',contactPerson:'',remarks:''});
  assert.equal(details.some(([label])=>label==='Contactpersoon'),false);
  assert.equal(details.some(([label])=>label==='Opmerkingen'),false);
  const result=pdf.createDocument({chain:'Scapino',storeName:'Scapino Test',visitDate:'2026-07-13',status:'Uitgevoerd',summary:'Controle uitgevoerd.',photos:[{data:''}]});
  assert.equal(result.profileKey,'scapino');assert.equal(result.photoCount,0);assert.equal(result.pageCount,1);
});

test('gesimuleerd iPhone-voorbeeldvenster ontvangt een geldige PDF-Blob',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldWindow=globalThis.window;
  Object.defineProperty(globalThis,'navigator',{value:{userAgent:'iPhone',platform:'iPhone',maxTouchPoints:1},configurable:true});
  const preview={closed:false,location:{href:''}};globalThis.window={open:()=>preview,location:{href:''}};
  try{
    const result=pdf.createDocument({chain:'Intersport',storeName:'Intersport Test',visitDate:'2026-07-13',status:'Uitgevoerd',summary:'Test.'});
    pdf.openOrDownload(result,{previewWindow:preview,revokeDelay:0});
    assert.match(preview.location.href,/^blob:/);await new Promise(resolve=>setTimeout(resolve,5));
  }finally{
    if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;
    globalThis.window=oldWindow;
  }
});

test('live routes worden na definitieve planning geforceerd en opgeslagen',()=>{
  assert.match(script,/window\.__GJ_SKIP_LEGACY_ROUTE_CALC__=true/);
  assert.match(script,/window\.__GJ_SKIP_LEGACY_ROUTE_CALC__=false/);
  assert.match(script,/withDeadline\(window\.loadPlanningFromSupabase\?\.\(\),20000/);
  assert.match(script,/const dates=plannedDates\(\)\.filter/);
  assert.match(script,/if\(progress\?\.open\)progress\.close\(\)/);
  assert.match(script,/if\(!stats\?\.live\)throw new Error/);
  assert.match(script,/route_live:route\.live===true\|\|route\.source==='TomTom'/);
  assert.match(script,/window\.gjInvalidateDayRouteCache/);
  assert.match(script,/sb\.from\('planning'\)\.select\('id,customer_id,route_volgorde'\)\.eq\('datum',date\)/);
  assert.match(script,/visit\.planningId=row\.id/);
});

test('complete dag wordt database-eerst verplaatst en realtime laden wacht',()=>{
  const databaseIndex=script.indexOf("await client().rpc('move_planning_day'");
  const localIndex=script.indexOf('source.forEach(v=>v.date=newDate)');
  assert.ok(databaseIndex>0&&localIndex>databaseIndex);
  assert.match(script,/Number\(moved\.data\?\.moved\)!==source\.length/);
  assert.match(script,/if\(window\.__GJ_LOCAL_MUTATION__\)\{pendingRemoteReload=true;return true\}/);
});

test('PDF-data komt uit bestaande tabellen en Storage ondersteunt private buckets',()=>{
  for(const table of ['visit_history','planning','customers','profiles','visit_photos'])assert.match(script,new RegExp(`from\\('${table}'\\)`));
  assert.match(script,/storage\.from\('visit-photos'\)\.download\(path\)/);
  assert.match(script,/createSignedUrl\(path,300\)/);
  assert.match(script,/c\.keten\|\|c\.Keten\|\|c\.chain/);
  assert.match(script,/const preview=isIOS\(\)\?window\.open\('about:blank'/);
});

test('alle verplichte gerenderde PDF-scenario’s bestaan',async()=>{
  const manifest=JSON.parse(manifestText);assert.equal(manifest.length,14);
  const byName=new Map(manifest.map(x=>[x.name,x]));
  assert.equal(byName.get('01-bijenkorf-4-fotos').profile,'bijenkorf');
  assert.equal(byName.get('02-scapino-8-fotos').photos,8);
  assert.equal(byName.get('05-onbekende-keten').profile,'stichd');
  assert.equal(byName.get('06-zonder-fotos').photos,0);
  assert.equal(byName.get('09-lange-samenvatting').pages,2);
  assert.ok(byName.get('14-meer-dan-8-fotos').pages>=2);
  for(const row of manifest)assert.ok((await stat(new URL('../'+row.file,import.meta.url))).size>2000,`${row.name} is leeg`);
});
