import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' }
});
const finite = (value: unknown) => Number.isFinite(Number(value));

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) throw new Error('Serverconfiguratie ontbreekt.');
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userResult, error: userError } = await service.auth.getUser(token);
    if (userError || !userResult.user) return json({ error: 'Niet ingelogd.' }, 401);
    const { data: profile } = await service.from('profiles').select('is_active').eq('id', userResult.user.id).maybeSingle();
    if (profile?.is_active === false) return json({ error: 'Account is uitgeschakeld.' }, 403);
    const { data: settings, error: settingsError } = await service.from('app_server_settings').select('tomtom_enabled,tomtom_api_key').eq('id', 1).single();
    if (settingsError || !settings?.tomtom_enabled || !settings.tomtom_api_key) return json({ error: 'TomTom staat uit.' }, 503);
    const body = await request.json();
    if (body.action === 'route') {
      if (![body.fromLat, body.fromLon, body.toLat, body.toLon].every(finite)) return json({ error: 'Ongeldige routecoördinaten.' }, 400);
      const travelMode = body.mode === 'walk' ? 'pedestrian' : 'car';
      const path = `${Number(body.fromLat)},${Number(body.fromLon)}:${Number(body.toLat)},${Number(body.toLon)}`;
      const endpoint = new URL(`https://api.tomtom.com/routing/1/calculateRoute/${path}/json`);
      endpoint.searchParams.set('key', settings.tomtom_api_key);
      endpoint.searchParams.set('travelMode', travelMode);
      endpoint.searchParams.set('traffic', travelMode === 'car' ? 'true' : 'false');
      const response = await fetch(endpoint);
      const result = await response.json();
      if (!response.ok || !result.routes?.[0]?.summary) throw new Error(result.error?.description || 'TomTom-route kon niet worden berekend.');
      return json(result);
    }
    if (body.action === 'geocode') {
      const query = String(body.query || '').trim();
      if (query.length < 3) return json({ error: 'Adres is te kort.' }, 400);
      const endpoint = new URL(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(query)}.json`);
      endpoint.searchParams.set('key', settings.tomtom_api_key);
      if (body.country) endpoint.searchParams.set('countrySet', String(body.country).toUpperCase());
      endpoint.searchParams.set('limit', '1');
      const response = await fetch(endpoint);
      const result = await response.json();
      const position = result.results?.[0]?.position;
      if (!response.ok || !position) throw new Error(result.errorText || 'Adres kon niet worden gevonden.');
      return json(result);
    }
    return json({ error: 'Onbekende actie.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
