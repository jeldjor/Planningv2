import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../v108.js', import.meta.url), 'utf8');

function createDom({ admin = false } = {}) {
  const adminHtml = admin ? '<section id="admin"><div class="panel"><div class="adminTabs"></div></div></section>' : '';
  const dom = new JSDOM(`<!doctype html><body><section id="settings"></section>${adminHtml}</body>`, {
    runScripts: 'outside-only', url: 'https://development.example.test/mobile.html'
  });
  Object.defineProperty(dom.window.navigator, 'onLine', { configurable: true, value: true });
  dom.window.eval(source);
  return dom;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('centraal uit toont geen toestemmingsmelding en vraagt geen GPS', async () => {
  const dom = createDom();
  let gpsCalls = 0;
  Object.defineProperty(dom.window.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition() { gpsCalls += 1; } }
  });
  dom.window.GJ_AUTH = { profile: { id: 'user-a' }, realUserId: 'user-a', impersonating: false, identitySb: {} };
  const manager = dom.window.__GJ_LIVE_LOCATIONS_V108__.manager;
  manager.initialized = true;
  manager.central = { enabled: false, update_interval_minutes: 10 };
  manager.own = null;
  manager.installOwnSettingsUi();
  await manager.reconcile({ direct: true });
  assert.equal(dom.window.document.getElementById('v108Consent'), null);
  assert.equal(gpsCalls, 0);
  assert.equal(dom.window.document.getElementById('v108LocationSettings'), null);
  manager.destroy();
});

test('toestemmingsmelding gebruikt exact de afgesproken tekst en Nu niet opent geen officiële vraag', async () => {
  const dom = createDom();
  let gpsCalls = 0;
  Object.defineProperty(dom.window.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition() { gpsCalls += 1; } }
  });
  dom.window.GJ_AUTH = { profile: { id: 'user-a' }, realUserId: 'user-a', impersonating: false, identitySb: {} };
  const manager = dom.window.__GJ_LIVE_LOCATIONS_V108__.manager;
  manager.initialized = true;
  manager.central = { enabled: true, update_interval_minutes: 10 };
  manager.own = { admin_enabled: true, route_location_enabled: false, app_prompt_state: 'not_asked', permission_state: 'unknown' };
  manager.installOwnSettingsUi();
  manager.setOwn = async (value) => {
    manager.own = {
      route_location_enabled: value.enabled,
      app_prompt_state: value.promptState,
      permission_state: value.permissionState
    };
    return manager.own;
  };
  await manager.reconcile({ direct: true });
  const modal = dom.window.document.getElementById('v108Consent');
  assert.ok(modal);
  assert.equal(modal.querySelector('h2').textContent, 'Routefunctionaliteit inschakelen');
  assert.equal(modal.querySelector('p').textContent, 'Deze app gebruikt je locatie voor route- en navigatiefuncties met Google Maps, Waze en Kaarten.');
  assert.equal(dom.window.document.getElementById('v108ConsentAllow').textContent, 'Toestaan');
  assert.equal(dom.window.document.getElementById('v108ConsentLater').textContent, 'Nu niet');
  dom.window.document.getElementById('v108ConsentLater').click();
  await tick();
  assert.equal(gpsCalls, 0);
  assert.equal(manager.own.app_prompt_state, 'deferred');
  assert.equal(dom.window.document.getElementById('v108Consent'), null);
  manager.destroy();
});

test('Toestaan start de officiële locatievraag en schrijft zonder gekozen user_id', async () => {
  const dom = createDom();
  let gpsCalls = 0;
  const rpcCalls = [];
  Object.defineProperty(dom.window.navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition(success) {
        gpsCalls += 1;
        success({
          timestamp: Date.now(),
          coords: { latitude: 51.37, longitude: 6.17, accuracy: 8, speed: null, heading: null }
        });
      }
    }
  });
  const client = {
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      if (name === 'set_my_location_preference') return { data: {
        user_id: 'user-a', admin_enabled: true, route_location_enabled: true, app_prompt_state: 'accepted',
        permission_state: args.p_permission_state, last_error: null
      }, error: null };
      return { data: { received_at: new Date().toISOString() }, error: null };
    }
  };
  dom.window.GJ_AUTH = { profile: { id: 'user-a' }, realUserId: 'user-a', impersonating: false, identitySb: client };
  const manager = dom.window.__GJ_LIVE_LOCATIONS_V108__.manager;
  manager.initialized = true;
  manager.central = { enabled: true, update_interval_minutes: 10 };
  manager.own = { admin_enabled: true, route_location_enabled: false, app_prompt_state: 'not_asked', permission_state: 'unknown' };
  manager.installOwnSettingsUi();
  manager.showConsent();
  dom.window.document.getElementById('v108ConsentAllow').click();
  await tick();
  await tick();
  assert.equal(gpsCalls, 1);
  const save = rpcCalls.find((call) => call.name === 'save_my_live_location');
  assert.ok(save);
  assert.equal(Object.hasOwn(save.args, 'user_id'), false);
  assert.equal(Object.hasOwn(save.args, 'p_user_id'), false);
  manager.destroy();
});

test('Beheer → Live Locaties wordt alleen voor de bestaande beheerrol opgebouwd', () => {
  const dom = createDom({ admin: true });
  dom.window.GJ_AUTH = { profile: { id: 'admin' }, realUserId: 'admin', isAdmin: true, impersonating: false, identitySb: {} };
  const manager = dom.window.__GJ_LIVE_LOCATIONS_V108__.manager;
  manager.installAdminUi();
  assert.equal(dom.window.document.querySelector('[data-admin-tab="liveLocations"]').textContent, 'Live Locaties');
  assert.ok(dom.window.document.getElementById('adminPaneLiveLocations'));
});

test('mobiele Live Locaties-tab heeft geen verborgen beheerpaneel als voorouder', () => {
  const dom = new JSDOM('<!doctype html><body><section id="adminMobile"><div class="adminTabs"><button class="adminTab" data-admin-tab="users">Gebruikers</button></div><div id="adminPaneUsers" class="adminPane"><div class="panel"></div></div></section></body>', {runScripts:'outside-only',url:'https://development.example.test/mobile.html'});
  dom.window.eval(source);
  dom.window.GJ_AUTH={profile:{id:'admin'},realUserId:'admin',isAdmin:true,impersonating:false,identitySb:{}};
  const manager=dom.window.__GJ_LIVE_LOCATIONS_V108__.manager;
  manager.installAdminUi();
  const pane=dom.window.document.getElementById('adminPaneLiveLocations'),tab=dom.window.document.querySelector('[data-admin-tab="liveLocations"]');
  assert.equal(pane.parentElement.id,'adminMobile');
  dom.window.document.querySelectorAll('#adminMobile .adminPane').forEach(item=>item.hidden=true);
  pane.hidden=false;
  assert.equal(tab.textContent,'Live Locaties');
  assert.equal(pane.closest('.adminPane[hidden]'),null);
});

test('zonder inschakeling door beheer verschijnt geen melding of gebruikersinstelling', async () => {
  const dom = createDom();
  let gpsCalls = 0;
  Object.defineProperty(dom.window.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition() { gpsCalls += 1; } }
  });
  dom.window.GJ_AUTH = { profile: { id: 'user-a' }, realUserId: 'user-a', impersonating: false, identitySb: {} };
  const manager = dom.window.__GJ_LIVE_LOCATIONS_V108__.manager;
  manager.initialized = true;
  manager.central = { enabled: true, update_interval_minutes: 10 };
  manager.own = { admin_enabled: false, route_location_enabled: false, app_prompt_state: 'not_asked', permission_state: 'unknown' };
  manager.installOwnSettingsUi();
  await manager.reconcile({ direct: true });
  assert.equal(dom.window.document.getElementById('v108LocationSettings'), null);
  assert.equal(dom.window.document.getElementById('v108Consent'), null);
  assert.equal(gpsCalls, 0);
  manager.destroy();
});
