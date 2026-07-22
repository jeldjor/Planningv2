import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const laptop=read('laptop.html'),mobile=read('mobile.html'),feature=read('v114.js'),sql=read('SUPABASE_V11_3_8_DAY_LOCK.sql');

test('de volledige laptopbron is hersteld en laadt de dagveiligheid',()=>{
  assert.ok(laptop.length>790000,'laptop.html hoort de volledige applicatie te bevatten');
  assert.match(laptop,/function visitsOn\(/);
  assert.match(laptop,/function generatePlanning\(/);
  assert.match(laptop,/function saveVisit\(/);
  for(const html of [laptop,mobile])assert.match(html,/v114\.css\?v=11400/);
  assert.match(laptop,/v114\.js\?v=1140[01]/);
  assert.match(mobile,/v114\.js\?v=11402/);
});

test('alle bekende verplaatsingsroutes hebben een terminale statusblokkade',()=>{
  assert.match(feature,/remove_planning_day/);
  assert.match(feature,/move_planning_day/);
  for(const action of ['openMoveDialogForVisit','moveOut','startDragVisit','editVisitTime','saveMoveDialog','generatePlanning','dropVisitOnDate'])assert.match(feature,new RegExp(action));
  assert.match(feature,/uitgevoerd','niet uitgevoerd','bezocht/);
});

test('de mobiele interface toont geen hele-dagknop en verwijdert planningsknoppen van een afgeronde opdracht',()=>{
  assert.doesNotMatch(read('mobile.html'),/v114MobileRemoveDay|Hele dag uit planning halen/);
  assert.match(read('mobile.html'),/v114\.js\?v=11402/);
  assert.doesNotMatch(read('brand.css'),/v114MobileRemoveDay|v114RemoveDay/);
  const dom=new JSDOM('<!doctype html><body data-gj-device-location="enabled"><section id="today"><div class="smallBtns"></div><div id="todayRoute"><div class="visitCard"><button class="eyeBtn" data-id="done-1">tijd</button><div class="smallBtns"><button class="moveUp" data-id="done-1">omhoog</button><button class="removePlan" data-id="done-1">uit planning</button></div></div></div></section></body>',{runScripts:'outside-only'});
  dom.window.alert=()=>{};dom.window.confirm=()=>true;
  dom.window.GJ_MOBILE={state:()=>({visits:[{id:'done-1',status:'Uitgevoerd'}]}),removeFromPlanning:async()=>{},persist:()=>{},sync:async()=>{},render:()=>{}};
  dom.window.eval(feature);
  assert.equal(dom.window.document.getElementById('v114MobileRemoveDay'),null);
  assert.ok(dom.window.document.querySelector('.visitCard').classList.contains('v114LockedVisit'));
  assert.equal(dom.window.document.querySelector('.removePlan'),null);
  assert.equal(dom.window.document.querySelector('.moveUp'),null);
  assert.equal(dom.window.GJ_DAY_LOCK.isTerminal({status:'Niet uitgevoerd'}),true);
});

test('de laptop toont geen hele-dagknop en maakt een afgeronde opdracht niet sleepbaar of herplanbaar',()=>{
  const dom=new JSDOM('<!doctype html><body data-gj-device-location="disabled"><div class="routeHead"><button id="btnOptimize">Route</button></div><dialog id="moveDialog"></dialog></body>',{runScripts:'outside-only'});
  const w=dom.window;w.alert=()=>{};w.confirm=()=>false;
  w.db={visits:[{id:'done-1',status:'Uitgevoerd'}],unplanned:[],fixed:[],routeStats:{}};w.state={selected:'2026-07-21'};
  w.customerRow=()=>'<details class="customer x" draggable="true" ondragstart="startDragVisit(event,\'done-1\')" ondragend="endDragVisit()"><div class="actions"><button class="secondary" onclick="openMoveDialogForVisit(\'done-1\')">Herplan</button><button class="secondary" onclick="moveOut(\'done-1\')">Uit planning</button></div></details>';
  w.openMoveDialogForVisit=()=>{};w.moveOut=()=>{};w.startDragVisit=()=>{};w.editVisitTime=()=>{};w.saveMoveDialog=()=>{};w.generatePlanning=async()=>{};w.dropVisitOnDate=()=>{};w.visitsOn=()=>w.db.visits;
  w.eval(feature);
  const html=w.customerRow(w.db.visits[0]);
  assert.equal(w.document.getElementById('v114RemoveDay'),null);
  assert.match(html,/Datum vergrendeld/);
  assert.doesNotMatch(html,/Herplan|Uit planning|draggable="true"/);
});

test('Supabase beschermt voltooide regels en laat alleen expliciet leegmaken toe',()=>{
  assert.match(sql,/planning_completed_is_immutable/);
  assert.match(sql,/before update of datum,status,uitgevoerd or delete/i);
  assert.match(sql,/not public\.planyx_planning_is_completed\(status,uitgevoerd\)/);
  assert.match(sql,/create or replace function public\.remove_planning_day/);
  assert.match(sql,/create or replace function public\.move_planning_day/);
  assert.match(sql,/planyx\.allow_terminal_clear/);
  assert.match(sql,/action in \('planning','fixed','history','database','all'\)/);
});

test('bouw en app-shell nemen beide dagveiligheidsbestanden mee',()=>{
  const build=read('scripts/prepare-dist.mjs'),worker=read('service-worker.js');
  for(const file of ['v114.js','v114.css']){assert.match(build,new RegExp(file.replace('.','\\.')));assert.match(worker,new RegExp(file.replace('.','\\.')));}
});
