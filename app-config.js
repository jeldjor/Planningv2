(function () {
  "use strict";
  if (window.GJ_CONFIG_API) return;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function jwtRole(key) {
    if (!key.startsWith('eyJ')) return null;
    try {
      const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(window.atob(payload)).role || null;
    } catch (_) {
      return 'invalid';
    }
  }

  function validate() {
    const raw = window.GJ_RUNTIME_CONFIG || {};
    const config = {
      environment: clean(raw.environment).toLowerCase(),
      deploymentLabel: clean(raw.deploymentLabel),
      supabaseUrl: clean(raw.supabaseUrl).replace(/\/$/, ""),
      supabaseAnonKey: clean(raw.supabaseAnonKey),
      supabaseProjectRef: clean(raw.supabaseProjectRef).toLowerCase(),
      mapProvider: clean(raw.mapProvider || "openstreetmap").toLowerCase()
    };
    const errors = [];
    if (!['development', 'test'].includes(config.environment)) {
      errors.push('APP_ENV moet development of test zijn.');
    }
    if (!config.deploymentLabel) errors.push('APP_DEPLOYMENT_LABEL ontbreekt.');
    if (!config.supabaseUrl) errors.push('SUPABASE_URL ontbreekt.');
    if (!config.supabaseAnonKey) errors.push('SUPABASE_ANON_KEY ontbreekt.');
    if (!config.supabaseProjectRef) errors.push('SUPABASE_PROJECT_REF ontbreekt.');
    if (config.supabaseUrl) {
      let host = '';
      try {
        const parsed = new URL(config.supabaseUrl);
        host = parsed.hostname.toLowerCase();
        if (parsed.protocol !== 'https:') errors.push('SUPABASE_URL moet HTTPS gebruiken.');
        if (!host.endsWith('.supabase.co')) errors.push('SUPABASE_URL is geen geldig Supabase-projectadres.');
      } catch (_) {
        errors.push('SUPABASE_URL is ongeldig.');
      }
      if (host && config.supabaseProjectRef && host.split('.')[0] !== config.supabaseProjectRef) {
        errors.push('SUPABASE_PROJECT_REF komt niet overeen met SUPABASE_URL.');
      }
    }
    if (config.supabaseAnonKey && !/^(sb_publishable_|eyJ)/.test(config.supabaseAnonKey)) {
      errors.push('Gebruik uitsluitend de anon/public key; geen service-role-key.');
    }
    if (config.supabaseAnonKey.startsWith('eyJ') && jwtRole(config.supabaseAnonKey) !== 'anon') {
      errors.push('De JWT-key is geen anon-key. Een service-role-key mag nooit naar de browser.');
    }
    if (config.mapProvider !== 'openstreetmap') {
      errors.push('v10.8 ondersteunt uitsluitend de keyloze kaartprovider openstreetmap.');
    }
    return { ok: errors.length === 0, errors, config: Object.freeze(config) };
  }

  let cached = null;
  function result() {
    if (!cached) cached = validate();
    return cached;
  }
  function requireConfig() {
    const current = result();
    if (!current.ok) throw new Error('Developmentconfiguratie ontbreekt of is ongeldig:\n- ' + current.errors.join('\n- '));
    return current.config;
  }
  function createSupabaseClient() {
    const config = requireConfig();
    if (!window.supabase?.createClient) throw new Error('De Supabase-browserbibliotheek kon niet worden geladen.');
    return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  window.GJ_CONFIG_API = Object.freeze({ result, requireConfig, createSupabaseClient });
})();
