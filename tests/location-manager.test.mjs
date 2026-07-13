import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../v108.js', import.meta.url), 'utf8');

function loadModule() {
  let nextTimer = 1;
  const activeIntervals = new Set();
  const windowListeners = new Map();
  const documentListeners = new Map();
  const window = {
    addEventListener(type, handler) { windowListeners.set(type, handler); },
    removeEventListener(type) { windowListeners.delete(type); },
    GJ_AUTH: { profile: { id: 'real-user' }, realUserId: 'real-user', impersonating: false, identitySb: {} }
  };
  const document = {
    visibilityState: 'visible',
    getElementById() { return null; },
    querySelectorAll() { return []; },
    addEventListener(type, handler) { documentListeners.set(type, handler); },
    removeEventListener(type) { documentListeners.delete(type); },
    body: { insertAdjacentHTML() {} }
  };
  const context = {
    window, document,
    navigator: { onLine: true },
    console, URL, Intl, Date, Math, Number, String, Boolean, Object, Array, RegExp, Promise,
    queueMicrotask() {},
    setInterval() { const id = nextTimer++; activeIntervals.add(id); return id; },
    clearInterval(id) { activeIntervals.delete(id); },
    setTimeout(fn) { fn(); return nextTimer++; }, clearTimeout() {}
  };
  vm.runInNewContext(source, context);
  return { api: window.__GJ_LIVE_LOCATIONS_V108__, window, activeIntervals, windowListeners, documentListeners };
}

test('statusgrenzen volgen 1,5× en 3× de centrale frequentie', () => {
  const { api } = loadModule();
  const now = Date.parse('2026-07-13T12:00:00Z');
  const at = (minutes) => new Date(now - minutes * 60000).toISOString();
  assert.equal(api.test.locationStatus(at(15), 10, true, now).key, 'current');
  assert.equal(api.test.locationStatus(at(15.01), 10, true, now).key, 'stale');
  assert.equal(api.test.locationStatus(at(30), 10, true, now).key, 'stale');
  assert.equal(api.test.locationStatus(at(30.01), 10, true, now).key, 'offline');
  assert.equal(api.test.locationStatus(null, 10, true, now).key, 'none');
  assert.equal(api.test.locationStatus(at(1), 10, false, now).key, 'disabled');
});

test('herinitialiseren van de locatiecyclus houdt precies één interval en één listenerset', () => {
  const { api, activeIntervals, windowListeners, documentListeners } = loadModule();
  const manager = api.manager;
  manager.central = { enabled: true, update_interval_minutes: 10 };
  manager.own = { route_location_enabled: true, app_prompt_state: 'accepted', permission_state: 'granted' };
  manager.startLocationCycle();
  manager.startLocationCycle();
  assert.equal(activeIntervals.size, 1);
  assert.equal(manager.locationListenersBound, true);
  assert.ok(windowListeners.has('focus'));
  assert.ok(windowListeners.has('pageshow'));
  assert.ok(windowListeners.has('online'));
  assert.ok(documentListeners.has('visibilitychange'));
  manager.stopLocationCycle();
  assert.equal(activeIntervals.size, 0);
  assert.equal(manager.locationListenersBound, false);
});

test('centraal uit en Voordoen als gebruiker starten geen locatietimer', () => {
  const { api, window, activeIntervals } = loadModule();
  const manager = api.manager;
  manager.own = { route_location_enabled: true, app_prompt_state: 'accepted', permission_state: 'granted' };
  manager.central = { enabled: false, update_interval_minutes: 10 };
  manager.startLocationCycle();
  assert.equal(activeIntervals.size, 0);
  manager.central.enabled = true;
  window.GJ_AUTH.impersonating = true;
  manager.startLocationCycle();
  assert.equal(activeIntervals.size, 0);
});

