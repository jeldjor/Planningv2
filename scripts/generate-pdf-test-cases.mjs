import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),pdf=require('../visit-pdf.js');
const output=resolve('output/pdf');await mkdir(output,{recursive:true});
const photoData=[];
for(let i=1;i<=8;i++)photoData.push('data:image/jpeg;base64,'+(await readFile(resolve(`tests/fixtures/store-${i}.jpg`))).toString('base64'));
const photos=n=>photoData.slice(0,n).map((data,index)=>({name:`winkel-${index+1}.jpg`,data}));
const base={storeName:'Testwinkel Centrum',branch:'Centrum',street:'Marktstraat',houseNumber:'12',postalCode:'5611 EB',city:'Eindhoven',contactPerson:'Alex de Vries',visitor:'Kim Kolijn',visitDate:'2026-07-13',startTime:'10:00',endTime:'11:15',activity:'Winkelcheck en presentatiecontrole',status:'Uitgevoerd',summary:'De winkelpresentatie is gecontroleerd. De collectie staat verzorgd en de afgesproken aanpassingen zijn uitgevoerd. De aandachtspunten zijn met de contactpersoon besproken.',followUp:'Nieuwe presentatie tijdens het volgende bezoek controleren.',remarks:'Goede samenwerking met het winkelteam.',generatedAt:'2026-07-13T12:00:00Z'};
const longSummary=Array.from({length:9},(_,i)=>`Bevinding ${i+1}: de collectie, maatvoering, presentatie, signing en voorraadpositie zijn zorgvuldig gecontroleerd. Afwijkingen zijn besproken met het winkelteam en vastgelegd voor opvolging tijdens het volgende bezoek.`).join(' ');
const cases=[
 ['01-bijenkorf-4-fotos',{...base,chain:'Bijenkorf',storeName:'de Bijenkorf Eindhoven',photos:photos(4)}],
 ['02-scapino-8-fotos',{...base,chain:'Scapino',storeName:'Scapino Breda',city:'Breda',photos:photos(8)}],
 ['03-intersport-2-fotos',{...base,chain:'Intersport',storeName:'Intersport Tilburg',city:'Tilburg',photos:photos(2)}],
 ['04-van-tilburg-sport-6-fotos',{...base,chain:'Van Tilburg Sport',storeName:'Van Tilburg Sport Nistelrode',city:'Nistelrode',photos:photos(6)}],
 ['05-onbekende-keten',{...base,chain:'Regionale Sportwinkel',storeName:'Sporthuis De Markt',photos:photos(3)}],
 ['06-zonder-fotos',{...base,chain:'INNO',storeName:'INNO Antwerpen',city:'Antwerpen',photos:[]}],
 ['07-een-foto',{...base,chain:'Scapino',storeName:'Scapino Den Bosch',photos:photos(1)}],
 ['08-niet-uitgevoerd',{...base,chain:'Intersport',storeName:'Intersport Breda',status:'Niet uitgevoerd',summary:'Het bezoek kon niet worden uitgevoerd omdat de vestiging onverwacht gesloten was.',remarks:'Vestiging onverwacht gesloten.',photos:[]}],
 ['09-lange-samenvatting',{...base,chain:'Bijenkorf',storeName:'de Bijenkorf Utrecht',city:'Utrecht',summary:longSummary,photos:photos(4)}],
 ['10-zonder-contactpersoon',{...base,chain:'Scapino',storeName:'Scapino Eindhoven',contactPerson:'',photos:photos(2)}],
 ['11-ontbrekend-logo',{...base,chain:'INNO',storeName:'INNO Brussel',city:'Brussel',photos:photos(3)}],
 ['12-onbereikbare-foto',{...base,chain:'Intersport',storeName:'Intersport Eindhoven',photos:[...photos(2),{name:'ontbreekt.jpg',data:''}]}],
 ['13-iphone-weergave',{...base,chain:'Van Tilburg Sport',storeName:'Van Tilburg Sport Eindhoven',photos:photos(5)}],
 ['14-meer-dan-8-fotos',{...base,chain:'Scapino',storeName:'Scapino Utrecht',city:'Utrecht',photos:[...photos(8),...photos(2)]}]
];
const manifest=[];
for(const [name,report] of cases){
 const result=pdf.createDocument(report);const file=resolve(output,`${name}.pdf`);
 await writeFile(file,Buffer.from(result.doc.output('arraybuffer')));
 manifest.push({name,file:`output/pdf/${name}.pdf`,profile:result.profileKey,pages:result.pageCount,photos:result.photoCount,customer:report.storeName,status:report.status});
}
await writeFile(resolve(output,'pdf-test-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
