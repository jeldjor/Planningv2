import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app-config.js', import.meta.url), 'utf8');

function load(runtimeConfig) {
  const window = {
    GJ_RUNTIME_CONFIG: runtimeConfig,
    supabase: { createClient: (url, key) => ({ url, key }) },
    atob: (value) => Buffer.from(value, 'base64url').toString('utf8')
  };
  vm.runInNewContext(source, { window, URL });
  return window.GJ_CONFIG_API;
}

test('ontbrekende developmentconfiguratie wordt geblokkeerd', () => {
  const api = load({});
  assert.equal(api.result().ok, false);
  assert.throws(() => api.requireConfig(), /Developmentconfiguratie ontbreekt/);
});

test('geldige developmentconfiguratie maakt uitsluitend een anonclient', () => {
  const api = load({
    environment: 'development', deploymentLabel: 'Test',
    supabaseUrl: 'https://testproject.supabase.co',
    supabaseAnonKey: 'sb_publishable_test_public_key',
    supabaseProjectRef: 'testproject', mapProvider: 'openstreetmap'
  });
  assert.equal(api.result().ok, true);
  assert.deepEqual({ ...api.createSupabaseClient() }, {
    url: 'https://testproject.supabase.co', key: 'sb_publishable_test_public_key'
  });
});

test('afwijkende project-ref en servicekey worden geblokkeerd', () => {
  const mismatch = load({
    environment: 'test', deploymentLabel: 'Test',
    supabaseUrl: 'https://project-a.supabase.co', supabaseAnonKey: 'sb_publishable_public',
    supabaseProjectRef: 'project-b', mapProvider: 'openstreetmap'
  });
  assert.equal(mismatch.result().ok, false);
  assert.match(mismatch.result().errors.join(' '), /komt niet overeen/);
  const secret = load({
    environment: 'development', deploymentLabel: 'Test',
    supabaseUrl: 'https://project-a.supabase.co', supabaseAnonKey: 'sb_secret_forbidden',
    supabaseProjectRef: 'project-a', mapProvider: 'openstreetmap'
  });
  assert.equal(secret.result().ok, false);
  assert.match(secret.result().errors.join(' '), /anon\/public key/);
  const serviceJwt = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"role":"service_role"}').toString('base64url')}.x`;
  const legacySecret = load({
    environment: 'development', deploymentLabel: 'Test',
    supabaseUrl: 'https://project-a.supabase.co', supabaseAnonKey: serviceJwt,
    supabaseProjectRef: 'project-a', mapProvider: 'openstreetmap'
  });
  assert.equal(legacySecret.result().ok, false);
  assert.match(legacySecret.result().errors.join(' '), /geen anon-key/);
});
