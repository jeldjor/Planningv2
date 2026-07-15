import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-request-id'
};

type ErrorInfo = { code: string; message: string; retryable: boolean };
class RouteError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, message: string, retryable = false) {
    super(message); this.name = 'RouteError'; this.code = code; this.retryable = retryable;
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const json = (body: unknown, status = 200, requestId = '') => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'x-request-id': requestId }
});
const info = (error: unknown): ErrorInfo => error instanceof RouteError
  ? { code: error.code, message: error.message, retryable: error.retryable }
  : { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error), retryable: false };
const applicationError = (error: unknown, requestId: string, prefix = '') => {
  const value = info(error);
  console.warn(JSON.stringify({ requestId, code: value.code, retryable: value.retryable, message: value.message }));
  return json({ ok: false, error: `${prefix}${value.message}`, code: value.code, retryable: value.retryable, requestId }, 200, requestId);
};
const coordinate = (value: unknown, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
};

async function fetchJson(endpoint: URL, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    return { response, body };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new RouteError('TOMTOM_TIMEOUT', 'TomTom reageerde niet op tijd.', true);
    }
    throw new RouteError('TOMTOM_NETWORK', 'TomTom kon niet worden bereikt.', true);
  } finally {
    clearTimeout(timeout);
  }
}

async function calculateTomTomLeg(apiKey: string, leg: Record<string, unknown>) {
  const fromLat = coordinate(leg.fromLat, -90, 90), fromLon = coordinate(leg.fromLon, -180, 180);
  const toLat = coordinate(leg.toLat, -90, 90), toLon = coordinate(leg.toLon, -180, 180);
  if ([fromLat, fromLon, toLat, toLon].some((value) => value === null)) {
    throw new RouteError('INVALID_COORDINATES', 'Een routepunt heeft ongeldige coördinaten.');
  }
  if (Math.abs(fromLat! - toLat!) < 0.000001 && Math.abs(fromLon! - toLon!) < 0.000001) {
    return { travelTimeInSeconds: 60, lengthInMeters: 0, live: true, mode: leg.mode === 'walk' ? 'walk' : 'car' };
  }
  const travelMode = leg.mode === 'walk' ? 'pedestrian' : 'car';
  const endpoint = new URL(`https://api.tomtom.com/routing/1/calculateRoute/${fromLat},${fromLon}:${toLat},${toLon}/json`);
  endpoint.searchParams.set('key', apiKey);
  endpoint.searchParams.set('travelMode', travelMode);
  endpoint.searchParams.set('traffic', travelMode === 'car' ? 'true' : 'false');
  endpoint.searchParams.set('routeType', 'fastest');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { response, body } = await fetchJson(endpoint);
      const summary = body?.routes?.[0]?.summary;
      const seconds = Number(summary?.travelTimeInSeconds), meters = Number(summary?.lengthInMeters);
      if (response.ok && Number.isFinite(seconds) && seconds > 0 && Number.isFinite(meters) && meters >= 0) {
        return { ...summary, live: true, mode: leg.mode === 'walk' ? 'walk' : 'car' };
      }
      const message = body?.error?.description || body?.detailedError?.message || body?.errorText || 'route niet beschikbaar';
      if (response.status === 429 || response.status >= 500) {
        if (attempt < 2) { await pause(500 * (attempt + 1)); continue; }
        throw new RouteError(response.status === 429 ? 'TOMTOM_RATE_LIMIT' : 'TOMTOM_UNAVAILABLE', `TomTom HTTP ${response.status}: ${message}`, true);
      }
      throw new RouteError('TOMTOM_REJECTED', `TomTom HTTP ${response.status}: ${message}`);
    } catch (error) {
      const value = info(error);
      if (value.retryable && attempt < 2) { await pause(500 * (attempt + 1)); continue; }
      throw error;
    }
  }
  throw new RouteError('TOMTOM_UNAVAILABLE', 'TomTom-route kon niet worden berekend.', true);
}

async function calculateBatch(apiKey: string, legs: Record<string, unknown>[]) {
  const results = new Array(legs.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, legs.length) }, async () => {
    while (cursor < legs.length) {
      const index = cursor++;
      try { results[index] = await calculateTomTomLeg(apiKey, legs[index]); }
      catch (error) {
        const value = info(error);
        throw new RouteError(value.code, `Traject ${index + 1} van ${legs.length}: ${value.message}`, value.retryable);
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function geocode(apiKey: string, query: string, country: string) {
  const endpoint = new URL(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(query)}.json`);
  endpoint.searchParams.set('key', apiKey);
  if (country) endpoint.searchParams.set('countrySet', country.toUpperCase());
  endpoint.searchParams.set('limit', '1');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { response, body } = await fetchJson(endpoint);
      if (response.ok && body?.results?.[0]?.position) return body;
      if ((response.status === 429 || response.status >= 500) && attempt === 0) { await pause(500); continue; }
      throw new RouteError('GEOCODE_FAILED', body?.errorText || 'Adres kon niet worden gevonden.', response.status === 429 || response.status >= 500);
    } catch (error) {
      if (info(error).retryable && attempt === 0) { await pause(500); continue; }
      throw error;
    }
  }
  throw new RouteError('GEOCODE_FAILED', 'Adres kon niet worden gevonden.');
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return new Response('ok', { headers: { ...cors, 'x-request-id': requestId } });
  if (request.method !== 'POST') return json({ ok: false, error: 'Alleen POST is toegestaan.', code: 'METHOD_NOT_ALLOWED', retryable: false, requestId }, 405, requestId);
  try {
    const url = Deno.env.get('SUPABASE_URL'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) throw new RouteError('SERVER_CONFIG', 'Serverconfiguratie ontbreekt.');
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ ok: false, error: 'Niet ingelogd.', code: 'UNAUTHENTICATED', retryable: false, requestId }, 401, requestId);
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userResult, error: userError } = await service.auth.getUser(token);
    if (userError || !userResult.user) return json({ ok: false, error: 'Sessie is verlopen. Log opnieuw in.', code: 'UNAUTHENTICATED', retryable: false, requestId }, 401, requestId);
    const { data: profile, error: profileError } = await service.from('profiles').select('is_active').eq('id', userResult.user.id).maybeSingle();
    if (profileError) return applicationError(new RouteError('PROFILE_READ_FAILED', 'Gebruikersprofiel kon niet worden gecontroleerd.', true), requestId);
    if (profile?.is_active === false) return json({ ok: false, error: 'Account is uitgeschakeld.', code: 'ACCOUNT_DISABLED', retryable: false, requestId }, 403, requestId);
    const { data: settings, error: settingsError } = await service.from('app_server_settings').select('tomtom_enabled,tomtom_api_key').eq('id', 1).single();
    if (settingsError) return applicationError(new RouteError('CONFIG_READ_FAILED', 'TomTom-instellingen konden niet worden geladen.', true), requestId);
    if (!settings?.tomtom_enabled || !settings.tomtom_api_key) return applicationError(new RouteError('TOMTOM_DISABLED', 'TomTom staat uit.'), requestId);

    let body: Record<string, unknown>;
    try { body = await request.json(); }
    catch { return applicationError(new RouteError('INVALID_JSON', 'Ongeldig verzoek.'), requestId); }

    if (body.action === 'route') {
      try { return json({ ok: true, routes: [{ summary: await calculateTomTomLeg(settings.tomtom_api_key, body) }], requestId }, 200, requestId); }
      catch (error) { return applicationError(error, requestId); }
    }
    if (body.action === 'route-batch') {
      const legs = Array.isArray(body.legs) ? body.legs as Record<string, unknown>[] : [];
      if (!legs.length || legs.length > 30) return applicationError(new RouteError('INVALID_BATCH', 'Een dagroute moet 1 tot en met 30 trajecten bevatten.'), requestId);
      try { return json({ ok: true, legs: await calculateBatch(settings.tomtom_api_key, legs), requestId }, 200, requestId); }
      catch (error) { return applicationError(error, requestId); }
    }
    if (body.action === 'geocode') {
      const query = String(body.query || '').trim();
      if (query.length < 3 || query.length > 250) return applicationError(new RouteError('INVALID_ADDRESS', 'Adres moet 3 tot en met 250 tekens bevatten.'), requestId);
      try { return json({ ...(await geocode(settings.tomtom_api_key, query, String(body.country || ''))), ok: true, requestId }, 200, requestId); }
      catch (error) { return applicationError(error, requestId); }
    }
    return applicationError(new RouteError('UNSUPPORTED_ACTION', 'Onbekende actie.'), requestId);
  } catch (error) {
    const value = info(error);
    console.error(JSON.stringify({ requestId, code: value.code, message: value.message }));
    return json({ ok: false, error: 'De routefunctie kon het verzoek niet verwerken.', code: value.code, retryable: false, requestId }, 500, requestId);
  }
});
