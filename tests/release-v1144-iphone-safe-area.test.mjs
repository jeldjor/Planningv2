import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const mobile=read('mobile.html');
const auth=read('auth.js');
const brand=read('brand.css');
const worker=read('service-worker.js');

test('iPhone-scherm gebruikt de volledige dynamische viewport',()=>{
  assert.match(mobile,/viewport-fit=cover/);
  assert.match(mobile,/min-height:100dvh/);
  assert.match(mobile,/html\{background:#03152c\}/);
});

test('inlog- en tussenscherm lopen door onder de onderste safe-area',()=>{
  assert.match(auth,/#gjAuthGate\{[\s\S]*bottom:calc\(-1 \* env\(safe-area-inset-bottom\)\)[\s\S]*min-height:100dvh/);
  assert.match(auth,/#gjAuthGate\{[\s\S]*padding:calc\(20px \+ env\(safe-area-inset-top\)\)[\s\S]*env\(safe-area-inset-bottom\)/);
  assert.match(mobile,/\.splash\{[\s\S]*bottom:calc\(-1 \* env\(safe-area-inset-bottom\)\)[\s\S]*min-height:100dvh/);
});

test('Menu en Sync staan onder de iPhone-notch',()=>{
  assert.match(mobile,/\.header\{[\s\S]*padding:calc\(7px \+ env\(safe-area-inset-top\)\) calc\(8px \+ env\(safe-area-inset-right\)\) 7px calc\(8px \+ env\(safe-area-inset-left\)\)/);
  assert.doesNotMatch(mobile,/padding:7px 8px calc\(7px \+ env\(safe-area-inset-top\)\)/);
  assert.match(brand,/top:calc\(72px \+ env\(safe-area-inset-top\)\)!important/);
});

test('gewijzigde iPhone-assets worden zonder oude PWA-cache geladen',()=>{
  assert.match(mobile,/auth\.js\?v=10802-ui3/);
  assert.match(worker,/planyx-shell-v11\.3\.8-r5-iphone-safe-area-settings/);
});

test('technische startcoördinaten zijn weg en worden automatisch beheerd',()=>{
  assert.doesNotMatch(mobile,/id="mobileStartLat"|id="mobileStartLng"|Startbreedtegraad|Startlengtegraad/);
  assert.doesNotMatch(read('laptop.html'),/id="setStartLat"|id="setStartLng"|>Breedtegraad<|>Lengtegraad</);
  assert.match(mobile,/address!==previousAddress\|\|!Number\.isFinite\(lat\)\|\|!Number\.isFinite\(lng\)/);
  assert.match(read('laptop.html'),/address!==previousAddress\|\|!Number\.isFinite\(lat\)\|\|!Number\.isFinite\(lng\)/);
});
