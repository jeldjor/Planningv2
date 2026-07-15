import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const [laptop,mobile,script,styles,pkg]=await Promise.all([
  readFile(new URL('../laptop.html',import.meta.url),'utf8'),
  readFile(new URL('../mobile.html',import.meta.url),'utf8'),
  readFile(new URL('../v109.js',import.meta.url),'utf8'),
  readFile(new URL('../v109.css',import.meta.url),'utf8'),
  readFile(new URL('../package.json',import.meta.url),'utf8')
]);

test('v10.9 regressiebestanden en alle inline scripts zijn syntactisch geldig',()=>{
  new vm.Script(script,{filename:'v109.js'});
  for(const [name,html] of [['laptop',laptop],['mobile',mobile]]){
    const blocks=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim());
    blocks.forEach((code,index)=>new vm.Script(code,{filename:`${name}-inline-${index}.js`}));
  }
  assert.equal(JSON.parse(pkg).version,'11.3.0');
});

test('TomTom wordt centraal gecontroleerd en live routestatus is leidend',()=>{
  assert.match(script,/rpc\('get_tomtom_status'\)/);
  assert.match(script,/stats\.live===true/);
  assert.match(script,/if\(stats\.includesReturn===true\)return stats/);
  assert.match(script,/route_live:route\.live===true\|\|route\.source==='TomTom'/);
  assert.match(mobile,/visit\.routeLive=row\.routeLive/);
});

test('complete dag kan met alle daginstellingen worden verplaatst',()=>{
  assert.match(script,/application\/x-planning-gjsystems-day/);
  assert.match(script,/ev\.target\.closest\('\.customer'\)/);
  assert.match(script,/for\(const visit of source\)visit\.date=newDate/);
  assert.match(script,/db\.dayDepartures\[newDate\]=departure/);
  assert.match(script,/db\.disabledBreaks\[newDate\]=true/);
  assert.match(script,/await refreshChangedDays\(\[oldDate,newDate\]\)/);
});

test('definitieve statussen en foto-opslag zijn beschermd',()=>{
  assert.match(script,/gjPreserveTerminalStatus/);
  assert.match(laptop,/\['Uitgevoerd','Niet uitgevoerd','Bezocht'\]\.includes\(v\.status\)/);
  assert.match(mobile,/function photoFingerprint/);
  assert.match(mobile,/if\(finishBusy\)return/);
  assert.match(mobile,/eq\('file_path',path\)/);
});

test('iPhone en profielinterface volgen de afgesproken kleuren en telling',()=>{
  assert.match(mobile,/\$\('statDone'\)\.textContent=done\+'\/'\+real\.length/);
  assert.match(styles,/#fullRouteBtn/);
  assert.match(styles,/#c62828/);
  assert.match(styles,/#d9e0e8/);
  assert.match(styles,/nth-child\(4\)/);
  assert.match(laptop,/class="v109ProfilePreview"/);
  assert.match(mobile,/class="v109ProfilePreview"/);
  assert.match(styles,/place-items:center/);
});
