import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const read = (name) => readFile(resolve(root, name), 'utf8');
const hash = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');

test('nieuwe repository bevat geen bekende productieprojectconfiguratie of hardcoded Supabase-project-URL', async () => {
  const files = ['index.html', 'laptop.html', 'mobile.html', 'auth.js', 'app-config.js', 'v108.js'];
  const text = (await Promise.all(files.map((name) => readFile(resolve(root, name), 'utf8')))).join('\n');
  assert.doesNotMatch(text, /https:\/\/[a-z0-9]+\.supabase\.co/);
  assert.doesNotMatch(text, /sb_(?:publishable|secret)_[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(text, /createClient\(\s*['"]/);
});

test('locatieschrijven gebruikt geen vrije user_id en SQL bindt aan auth.uid()', async () => {
  const js = await read('v108.js');
  const sql = await read('SUPABASE_V10_8_LIVE_LOCATIONS_DEV.sql');
  const saveCall = js.match(/rpc\('save_my_live_location',[\s\S]*?\n\s*\}\);/)?.[0] || '';
  assert.ok(saveCall);
  assert.doesNotMatch(saveCall, /user_id/);
  assert.match(sql, /v_user_id uuid := \(select auth\.uid\(\)\)/);
  assert.match(sql, /force row level security/g);
  assert.match(sql, /enabled boolean not null default false/);
  assert.match(sql, /update_interval_minutes in \(5, 10, 15, 30, 60\)/);
  assert.match(sql, /create table if not exists public\.user_location_history/);
  assert.match(sql, /create or replace function public\.cleanup_location_history/);
  assert.doesNotMatch(sql, /cron\.schedule/);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete)[^;]*user_(live_locations|location_history|location_settings)/i);
  assert.match(sql, /raise exception 'Alleen beheerders mogen Live Locaties wijzigen'/);
  assert.match(sql, /create or replace function public\.set_user_location_enabled/);
  assert.match(sql, /admin_enabled boolean not null default false/);
  assert.match(sql, /p_hours not in \(1, 4, 8, 24\)/);
  assert.match(sql, /insert into public\.user_live_locations[\s\S]*insert into public\.user_location_history/);
});

test('lege developmentdatabase heeft een expliciete v10.7-baseline zonder productieaccount', async () => {
  const sql = await read('SUPABASE_V10_7_DEV_BASELINE.sql');
  for (const table of ['profiles','customers','planning','app_day_settings','app_absences','fixed_appointments','visit_history','visit_photos','contact_threads']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(sql, /role text not null default 'user'/);
  assert.doesNotMatch(sql, /georgio_jejanan|hotmail\.com/i);
  assert.match(sql, /create or replace function public\.is_app_admin/);
  assert.match(sql, /create or replace function public\.protect_profile_security_fields/);
  assert.match(sql, /new\.role := old\.role/);
  assert.match(sql, /create or replace function public\.clear_workspace_data/);
});

test('v10.7 ondersteunende modules en beeldbestanden blijven byte-identiek', async () => {
  const expected = {
    'v105.js': 'd4a27623d50ec1f640efd6cd61a54f0f993321d52d1ffd38ded72ee152612d27',
    'v105.css': '25985c610472e142d59cff38796c3efcf73657b9b2b85292fe724d11d4daf9da',
    'v106.js': 'bdf53d2bd8f229478ca8ba04593b5ff200b6f93942eeb1dd8519fe2c22185162',
    'v106.css': 'b87a49a20ad4b33fab4c64b56e6e091dddae0641a961f29559f3b2ebd950c06d',
    'logo.png': 'f02f9eff45d9ebc4a802b652e2d92ab441b8644fe22d9a959f19509ccdc13706',
    'logo-dark.png': 'b76a2c9e60a36dfcfd2ce2384d43d72f558a5568d0e543647d2d181fc5322e99',
    'logo-dark-menu.png': 'b76a2c9e60a36dfcfd2ce2384d43d72f558a5568d0e543647d2d181fc5322e99',
    'logo-header.png': '244d148ed14edf4ad5839db5121a017beba0f8413e298a23a711b30a423d9b03',
    'logo-light.png': '6021eeebd1ced20a4dcd366bc91479350b53d538fbf5dc1cb69a0c0ccb135064',
    'logo-login.png': '6021eeebd1ced20a4dcd366bc91479350b53d538fbf5dc1cb69a0c0ccb135064',
    'logo-menu.png': 'b76a2c9e60a36dfcfd2ce2384d43d72f558a5568d0e543647d2d181fc5322e99'
  };
  for (const [name, digest] of Object.entries(expected)) {
    assert.equal(await hash(resolve(root, name)), digest, `${name} is onverwacht gewijzigd`);
  }
});

test('beide apparaten laden runtimeconfig, v10.8-module en developmentversie', async () => {
  for (const name of ['laptop.html', 'mobile.html']) {
    const html = await read(name);
    assert.match(html, /runtime-config\.js/);
    assert.match(html, /app-config\.js\?v=10801/);
    assert.match(html, /auth\.js\?v=10802/);
    assert.match(html, /v108\.css\?v=10801/);
    assert.match(html, /v108\.js\?v=10801/);
    assert.match(html, /v10\.8\.1 DEV/);
  }
});

test('iPhone beheer blijft hard verborgen zonder beheerrol', async () => {
  const html = await read('mobile.html');
  const auth = await read('auth.js');
  assert.match(html, /body\.gj-admin \.menuPanel button\[data-screen="adminMobile"\]\{display:grid!important/);
  assert.doesNotMatch(html, /\n\.menuPanel button\[data-screen="adminMobile"\]\{display:grid!important/);
  assert.match(html, /el\.style\.display=isAdmin\?'':'none'/);
  assert.match(auth, /body:not\(\.gj-admin\) \.menuPanel button\.gjAdminOnly\{display:none!important\}/);
  assert.match(html, /adminButton&&window\.GJ_AUTH\?\.isAdmin!==true/);
});

test('laptop heeft een bereikbare Supabase-uitlogactie', async () => {
  const html = await read('laptop.html');
  assert.match(html, /<\/div>\s*<button id="desktopLogout"[^>]*>Uitloggen<\/button>\s*<\/aside>/);
  assert.match(html, /auth\.signOut\(\{scope:'local'\}\)/);
  assert.match(html, /sessionStorage\.removeItem\('gj_app_open_session'\)/);
  assert.match(html, /GJ_LOCATION_MANAGER\?\.destroy\?\.\(\)/);
  assert.match(html, /location\.replace\('\.\/index\.html'\)/);
});

test('alle inline scripts in laptop en iPhone zijn syntactisch compileerbaar', async () => {
  for (const name of ['laptop.html', 'mobile.html']) {
    const html = await read(name);
    const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
    assert.ok(scripts.length > 0);
    scripts.forEach((script, index) => {
      assert.doesNotThrow(() => new Function(script), `${name} inline script ${index + 1}`);
    });
  }
});
