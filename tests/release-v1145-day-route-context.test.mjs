import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const core=require('../planning-core.js');
const [laptop,mobile,integration,css,worker]=await Promise.all([
  readFile(new URL('../laptop.html',import.meta.url),'utf8'),
  readFile(new URL('../mobile.html',import.meta.url),'utf8'),
  readFile(new URL('../v11.js',import.meta.url),'utf8'),
  readFile(new URL('../v114.css',import.meta.url),'utf8'),
  readFile(new URL('../service-worker.js',import.meta.url),'utf8')
]);

test('vast eerste bezoek blijft vooraan en overige bezoeken worden vanaf daar geoptimaliseerd',()=>{
  const start={lat:0,lng:0},end={lat:0,lng:10};
  const visits=[
    {id:'laat',customer:{lat:0,lng:9}},
    {id:'eerste',customer:{lat:0,lng:5}},
    {id:'midden',customer:{lat:0,lng:6}}
  ];
  const optimized=core.optimizeVisits(visits,start,end,'eerste');
  assert.deepEqual(optimized.map(visit=>visit.id),['eerste','midden','laat']);
  assert.equal(optimized[0].id,'eerste');
});

test('dagroute gebruikt afzonderlijk start- en eindpunt',()=>{
  const start={lat:51.4,lng:5.4},end={lat:52.1,lng:5.1};
  const visits=[
    {id:'a',customer:{lat:51.6,lng:5.5}},
    {id:'b',customer:{lat:51.8,lng:5.3}}
  ];
  const requests=core.createLegRequests(visits,start,end,300);
  assert.deepEqual(requests[0].from,start);
  assert.deepEqual(requests.at(-1).to,end);
  assert.equal(requests.at(-1).return,true);
});

test('routehash verandert bij hotel, eindadres of eerste bezoek',()=>{
  const base={date:'2026-09-08',departure:'08:00',visits:[{id:'a',order:1,customer:{lat:1,lng:1,opening:'09:00-18:00'}}],absences:[],start:{lat:0,lng:0},end:{lat:0,lng:0}};
  const normal=core.routeInputHash(base);
  assert.notEqual(core.routeInputHash({...base,start:{lat:2,lng:2}}),normal);
  assert.notEqual(core.routeInputHash({...base,end:{lat:3,lng:3}}),normal);
  assert.notEqual(core.routeInputHash({...base,firstVisitId:'a'}),normal);
});

test('laptop en iPhone bieden dezelfde dagroutekeuzes en slaan ze centraal op',()=>{
  assert.match(integration,/startMode:'default'/);
  assert.match(integration,/\['home','start','custom'\]\.includes\(source\.endMode\)/);
  assert.match(integration,/Startpunt deze dag/);
  assert.match(integration,/Terug naar startadres van deze dag/);
  assert.match(integration,/Opslaan en route optimaliseren/);
  assert.match(integration,/routeContext:resolved\.context/);
  assert.match(integration,/data-first-visit/);
  assert.match(laptop,/Als eerste bezoeken/);
  assert.match(mobile,/Als eerste bezoeken/);
  assert.match(laptop,/startPointForDay/);
  assert.match(laptop,/endPointForDay/);
  assert.match(mobile,/context\.endMode==='start'/);
  assert.match(core.persistDay.toString(),/routeContext:result\.routeContext/);
  assert.match(css,/\.firstVisitBadge/);
  assert.match(css,/\.dayRouteEditorGrid/);
  assert.match(worker,/planyx-shell-v11.4.6-courier-r2/);
});
