import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const required = ['APP_ENV', 'APP_DEPLOYMENT_LABEL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_PROJECT_REF'];
const missing = required.filter((name) => !String(process.env[name] || '').trim());
if (missing.length) {
  throw new Error(`Ontbrekende deploymentvariabelen: ${missing.join(', ')}`);
}
if (!['development', 'test'].includes(process.env.APP_ENV)) {
  throw new Error('APP_ENV moet development of test zijn.');
}
const url = new URL(process.env.SUPABASE_URL);
if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) {
  throw new Error('SUPABASE_URL is geen geldig HTTPS Supabase-projectadres.');
}
if (url.hostname.split('.')[0] !== process.env.SUPABASE_PROJECT_REF) {
  throw new Error('SUPABASE_PROJECT_REF komt niet overeen met SUPABASE_URL.');
}
if (!/^(sb_publishable_|eyJ)/.test(process.env.SUPABASE_ANON_KEY)) {
  throw new Error('Gebruik uitsluitend de anon/public key; geen service-role-key.');
}
if (process.env.SUPABASE_ANON_KEY.startsWith('eyJ')) {
  let role = null;
  try { role = JSON.parse(Buffer.from(process.env.SUPABASE_ANON_KEY.split('.')[1], 'base64url').toString('utf8')).role; } catch {}
  if (role !== 'anon') throw new Error('De JWT-key is geen anon-key. Een service-role-key mag nooit naar de browser.');
}
const config = {
  environment: process.env.APP_ENV,
  deploymentLabel: process.env.APP_DEPLOYMENT_LABEL,
  supabaseUrl: process.env.SUPABASE_URL.replace(/\/$/, ''),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseProjectRef: process.env.SUPABASE_PROJECT_REF,
  mapProvider: process.env.MAP_PROVIDER || 'openstreetmap'
};
const output = `window.GJ_RUNTIME_CONFIG = Object.freeze(${JSON.stringify(config, null, 2)});\n`;
await writeFile(resolve('runtime-config.js'), output, { mode: 0o600 });
console.log('runtime-config.js is gemaakt voor project', config.supabaseProjectRef);
