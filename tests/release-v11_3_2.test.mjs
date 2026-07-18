import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

function storedZipEntries(bytes){
  const entries=new Map();let offset=0;
  while(offset+30<=bytes.length){
    const view=new DataView(bytes.buffer,bytes.byteOffset+offset);
    if(view.getUint32(0,true)!==0x04034b50)break;
    const size=view.getUint32(18,true),nameLength=view.getUint16(26,true),extraLength=view.getUint16(28,true);
    const nameStart=offset+30,name=new TextDecoder().decode(bytes.slice(nameStart,nameStart+nameLength)),dataStart=nameStart+nameLength+extraLength;
    entries.set(name,bytes.slice(dataStart,dataStart+size));offset=dataStart+size;
  }
  return entries;
}

test('v11.3.7 laadt de gedeelde foto-ZIP module op laptop en iPhone',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'11.3.7');
  for(const file of ['laptop.html','mobile.html']){
    const html=read(file);assert.match(html,/photo-zip\.js\?v=113500/);assert.match(html,/planning-core\.js\?v=113500/);
  }
  assert.match(read('laptop.html'),/Alle foto's opslaan \(\.zip\)/);
  assert.match(read('v11.js'),/data-v11-photo-zip/);
});

test('foto-ZIP bevat bezoekverslag en iedere foto als los bestand',async()=>{
  let sharedFile=null;
  const window={};
  const context={window,TextEncoder,TextDecoder,Uint8Array,Uint32Array,DataView,Blob,File,Date,URL,fetch,
    navigator:{canShare:()=>true,share:async payload=>{sharedFile=payload.files[0]}},
    document:{createElement(){throw new Error('downloadfallback hoort niet gebruikt te worden')}}};
  vm.runInNewContext(read('photo-zip.js'),context);
  const client={storage:{from:()=>({download:async filePath=>({data:new Blob([`beeld:${filePath}`],{type:'image/jpeg'}),error:null})})}};
  const result=await window.GJPhotoZip.download({client,photos:[{path:'a/eerste.jpeg'},{path:'b/tweede.png'}],customerName:'Voorbeeldwinkel Noord',visitDate:'2026-01-15',subject:'Testbezoek',summary:'Dit is een geanonimiseerde testsamenvatting.'});
  assert.equal(result.fileName,'Voorbeeldwinkel-Noord_2026-01-15.zip');assert.equal(result.downloaded,2);assert.ok(sharedFile);
  const entries=storedZipEntries(new Uint8Array(await sharedFile.arrayBuffer()));
  assert.deepEqual([...entries.keys()],['Bezoekverslag.txt','foto-01.jpg','foto-02.png']);
  const report=new TextDecoder().decode(entries.get('Bezoekverslag.txt'));
  assert.match(report,/Klant: Voorbeeldwinkel Noord/);assert.match(report,/Onderwerp: Testbezoek/);assert.match(report,/Datum bezoek: 2026-01-15/);assert.match(report,/Dit is een geanonimiseerde testsamenvatting\./);
});

test('volledig legen verwijdert eerst Storage en daarna databasekoppelingen',()=>{
  const sql=read('SUPABASE_V11_3_2_RELEASE.sql'),mobile=read('mobile.html'),laptop=read('laptop.html'),maintenance=read('v106.js');
  assert.match(sql,/create or replace function public\.clear_workspace_data/);
  assert.ok(sql.indexOf('delete from public.visit_photos')<sql.indexOf('delete from public.visit_history'));
  assert.ok(sql.indexOf('delete from public.visit_history')<sql.indexOf('delete from public.planning'));
  for(const source of [mobile,laptop]){
    assert.match(source,/storage\.from\('visit-photos'\)\.remove/);
    assert.match(source,/removeVisitStorageFiles/);
  }
  assert.match(read('v11.js'),/\.v106Maintenance/);
});

test('toekomstige uitvoerstatus zonder historie wordt gecorrigeerd en geblokkeerd',()=>{
  const sql=read('SUPABASE_V11_3_2_RELEASE.sql');
  assert.match(sql,/and not exists\([\s\S]*?from public\.visit_history/);
  assert.match(sql,/create constraint trigger planning_completed_requires_history/);
  assert.match(sql,/status='Gepland',uitgevoerd=false/);
});

test('afwezigheid verwijderen is database-eerst en synchroniseert laptop naar iPhone',()=>{
  const laptop=read('laptop.html'),sql=read('SUPABASE_V11_3_2_RELEASE.sql');
  assert.match(laptop,/async function delBlock/);
  assert.match(laptop,/from\('app_absences'\)\.delete\(\)\.eq\('id',block\.id\)/);
  assert.match(laptop,/async function loadAbsencesFromSupabase/);
  assert.match(laptop,/await loadAbsencesFromSupabase\(\)/);
  assert.match(sql,/alter table public\.app_absences replica identity full/);
});
