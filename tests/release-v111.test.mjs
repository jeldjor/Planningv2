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

test('oude v10.11 module blijft syntactisch geldig maar wordt niet meer geladen',()=>{
  new vm.Script(script,{filename:'v111.js'});
  assert.equal(JSON.parse(pkgText).version,'11.3.7');
  for(const html of [mobile,laptop]){
    assert.match(html,/v111\.css\?v=112000/);
    assert.doesNotMatch(html,/v111\.js\?v=11100/);
  }
});

test('mobiele dagtotalen gebruiken alle live trajecten inclusief terugrit',()=>{
  assert.match(mobile,/GJPlanningCore\.calculateDay/);
  assert.match(mobile,/walkThresholdMeters/);
  assert.match(mobile,/totals\.travelMin/);
  assert.match(mobile,/includesReturn:true/);
  assert.match(mobile,/live\?\.includesReturn&&Number\.isFinite/);
  assert.match(mobile,/Geen misleidend deeltotaal tonen/);
});

test('oude development/test-banner is onzichtbaar en wordt verwijderd',()=>{
  assert.match(style,/#v108DevBanner,.v108DevBanner\{display:none!important\}/);
  assert.match(script,/getElementById\('v108DevBanner'\)\?\.remove\(\)/);
});
