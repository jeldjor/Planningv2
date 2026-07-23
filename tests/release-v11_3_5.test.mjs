import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const require=createRequire(import.meta.url);
const visitPdf=require('../visit-pdf.js');

test('v11.3.8 gebruikt de gekozen rustige ontwerp-1 indeling',()=>{
  const source=read('visit-pdf.js');
  assert.match(source,/drawReportIntro\(doc,report,headerBottom\+13,profile\)/);
  assert.match(source,/y=drawDetails\(doc,report,y,profile\);\s*y=drawTextSections/);
  assert.match(source,/y=drawPhotoBlock\(doc,firstPhotos,y,profile,wanted\)/);
  assert.match(source,/columns=3,cellW=56/);
});

test('bezoekinformatie bevat precies één datum en nooit bezoekstijden',()=>{
  const fields=visitPdf.buildDetailFields({
    storeName:'Voorbeeldwinkel Noord',branch:'Centrum',street:'Testlaan',houseNumber:'12',
    postalCode:'1234 AB',city:'Voorbeeldstad',visitDate:'2026-07-16',
    startTime:'08:30',endTime:'09:15',activity:'Winkelpresentatie',visitor:'Testgebruiker',status:'Uitgevoerd'
  });
  assert.deepEqual(fields.map(([label])=>label),['Winkel','Locatie','Datum','Activiteit','Bezoeker']);
  assert.equal(fields.filter(([label])=>label==='Datum').length,1);
  assert.ok(!fields.flat().some(value=>String(value).includes('08:30')||String(value).includes('09:15')));
});

test('status en tekstvelden staan niet dubbel in informatieblok en tekstsecties',()=>{
  const fields=visitPdf.buildDetailFields({storeName:'Voorbeeldwinkel Zuid',visitDate:'2026-01-16',status:'Uitgevoerd',summary:'Zelfde tekst',remarks:'Zelfde tekst'});
  assert.ok(!fields.some(([label])=>['Status','Samenvatting','Opmerkingen','Vervolgactie'].includes(label)));
  const sections=visitPdf.buildTextSections({summary:'Zelfde tekst',remarks:'Zelfde tekst',followUp:'Controle bij volgend bezoek.'});
  assert.deepEqual(sections,[['Bevindingen en samenvatting','Zelfde tekst'],['Vervolgactie','Controle bij volgend bezoek.']]);
});

test('footer herhaalt de bezoekdatum niet als generatiedatum',()=>{
  const source=read('visit-pdf.js');
  assert.doesNotMatch(source,/Gegenereerd:|formatGeneratedDate/);
  assert.match(source,/doc\.text\('GJsystems',14,pageH-8\)/);
  assert.doesNotMatch(source,/Planning-GJsystems  -  Stichd/);
  assert.match(source,/Pagina \$\{page\} van \$\{total\}/);
});

test('v11.3.8 vernieuwt PDF-code en app-cache op laptop en iPhone',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'11.3.8');
  assert.match(read('service-worker.js'),/planyx-shell-v11\.3\.8-r2/);
  for(const html of ['laptop.html','mobile.html']){
    assert.match(read(html),/visit-pdf\.js\?v=113500/);
    assert.match(read(html),/planning-core\.js\?v=113500/);
  }
});
