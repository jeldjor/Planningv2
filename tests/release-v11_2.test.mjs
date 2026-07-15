import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),core=require('../planning-core.js'),root=new URL('../',import.meta.url);
const [mobile,laptop,v109,edge,sql,pkg,worker]=await Promise.all([
  readFile(new URL('mobile.html',root),'utf8'),readFile(new URL('laptop.html',root),'utf8'),
  readFile(new URL('v109.js',root),'utf8'),readFile(new URL('supabase/functions/tomtom-proxy/index.ts',root),'utf8'),
  readFile(new URL('SUPABASE_V11_2_RELEASE.sql',root),'utf8'),readFile(new URL('package.json',root),'utf8'),
  readFile(new URL('service-worker.js',root),'utf8')
]);

test('v11.2 gebruikt één gedeelde TomTom-dagbatch zonder losse routecyclus',()=>{
  assert.equal(JSON.parse(pkg).version,'11.3.0');
  assert.equal(core.VERSION,'11.3.0');
  assert.match(core.requestRouteBatch.toString(),/action:'route-batch'/);
  assert.doesNotMatch([mobile,laptop,v109].join('\n'),/functions\.invoke\('tomtom-proxy',[\s\S]{0,180}action:'route'/);
  assert.match(worker,/planning-gjsystems-shell-v11\.3\.0/);
});

test('TomTom Edge Function heeft begrensde paralleliteit en een stabiel foutcontract',()=>{
  assert.match(edge,/@supabase\/supabase-js@2\.95\.0/);
  assert.match(edge,/Math\.min\(4, legs\.length\)/);
  assert.match(edge,/retryable/);
  assert.match(edge,/requestId/);
  assert.match(edge,/applicationError/);
  assert.match(edge,/TOMTOM_RATE_LIMIT/);
  assert.match(edge,/INVALID_COORDINATES/);
});

test('centrale routeopslag eist alle trajecten en een live terugrit',()=>{
  assert.match(sql,/Niet alle TomTom-trajecten zijn live berekend/);
  assert.match(sql,/De complete terugroute ontbreekt/);
  assert.match(sql,/jsonb_build_object\('live',true,'includesReturn',true\)/);
  assert.match(sql,/revoke all on function public\.handle_new_auth_user\(\) from public,anon,authenticated/);
  assert.match(sql,/create index if not exists app_server_settings_updated_by_idx/);
  assert.match(core.persistDay.toString(),/includesReturn/);
  assert.match(core.persistDay.toString(),/duurde te lang/);
});

test('iPhone-login laadt data zonder automatisch externe routes te starten',()=>{
  assert.doesNotMatch(mobile,/todayRows\.some\(v=>!v\.routeLive\)/);
  assert.doesNotMatch(mobile,/Automatische live route/);
  assert.match(mobile,/includesReturn:route\.includesReturn===true/);
  assert.match(laptop,/includesReturn:route\.includesReturn===true/);
});

test('ongeldige coördinaten worden vóór een Edge-aanroep geweigerd',()=>{
  assert.equal(core.hasPoint({lat:91,lng:5}),false);
  assert.equal(core.hasPoint({lat:52,lng:181}),false);
  assert.equal(core.hasPoint({lat:52,lng:5}),true);
});
