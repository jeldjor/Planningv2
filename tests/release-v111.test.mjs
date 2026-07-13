import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const [mobile,laptop,script,style,pkgText]=await Promise.all([
  readFile(new URL('mobile.html',root),'utf8'),
  readFile(new URL('laptop.html',root),'utf8'),
  readFile(new URL('v111.js',root),'utf8'),
  readFile(new URL('v111.css',root),'utf8'),
  readFile(new URL('package.json',root),'utf8')
]);

test('v10.11 releasebestanden zijn geldig en geladen',()=>{
  new vm.Script(script,{filename:'v111.js'});
  assert.equal(JSON.parse(pkgText).version,'10.11.0');
  for(const html of [mobile,laptop]){
    assert.match(html,/v111\.css\?v=11100/);
    assert.match(html,/v111\.js\?v=11100/);
  }
});

test('mobiele dagtotalen gebruiken alle live trajecten inclusief terugrit',()=>{
  assert.match(mobile,/const returnRoute=await mobileTomTomLeg\(previous,home,'car'\)/);
  assert.match(mobile,/storedMode=visit\.mode==='walk'\?'walk':visit\.mode==='drive'\?'car':null/);
  assert.match(mobile,/totalKm\+=returnRoute\.km;totalDriveMin\+=returnRoute\.min/);
  assert.match(mobile,/includesReturn:true/);
  assert.match(mobile,/live\?\.live&&live\.includesReturn/);
  assert.match(mobile,/Math\.max\(0,Number\(v\.travel\|\|0\)-\(v\.mode==='walk'\?0:15\)\)/);
});

test('oude development/test-banner is onzichtbaar en wordt verwijderd',()=>{
  assert.match(style,/#v108DevBanner,.v108DevBanner\{display:none!important\}/);
  assert.match(script,/getElementById\('v108DevBanner'\)\?\.remove\(\)/);
});
