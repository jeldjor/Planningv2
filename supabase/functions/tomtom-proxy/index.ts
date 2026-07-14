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

async function calculateTomTomLeg(settings: { tomtom_api_key: string }, leg: Record<string, unknown>) {
  if (![leg.fromLat, leg.fromLon, leg.toLat, leg.toLon].every(finite)) throw new Error('Ongeldige routecoördinaten.');
  const travelMode = leg.mode === 'walk' ? 'pedestrian' : 'car';
  const path = `${Number(leg.fromLat)},${Number(leg.fromLon)}:${Number(leg.toLat)},${Number(leg.toLon)}`;
  const endpoint = new URL(`https://api.tomtom.com/routing/1/calculateRoute/${path}/json`);
  endpoint.searchParams.set('key', settings.tomtom_api_key);
  endpoint.searchParams.set('travelMode', travelMode);
  endpoint.searchParams.set('traffic', travelMode === 'car' ? 'true' : 'false');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(endpoint, { signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('TomTom reageerde niet binnen 15 seconden.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const result = await response.json();
  const summary = result.routes?.[0]?.summary;
  if (!response.ok || !summary) throw new Error(result.error?.description || 'TomTom-route kon niet worden berekend.');
  return { ...summary, live: true, mode: leg.mode === 'walk' ? 'walk' : 'car' };
}

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
      const summary = await calculateTomTomLeg(settings, body);
      return json({ routes: [{ summary }] });
    }
    if (body.action === 'route-batch') {
      const legs = Array.isArray(body.legs) ? body.legs : [];
      if (!legs.length || legs.length > 30) return json({ error: 'Een dagroute moet 1 tot en met 30 trajecten bevatten.' }, 400);
      const summaries = await Promise.all(legs.map((leg: Record<string, unknown>) => calculateTomTomLeg(settings, leg)));
      return json({ legs: summaries });
    }
    if (body.action === 'geocode') {
      const query = String(body.query || '').trim();
      if (query.length < 3 || query.length > 250) return json({ error: 'Adres moet 3 tot en met 250 tekens bevatten.' }, 400);
      const endpoint = new URL(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(query)}.json`);
      endpoint.searchParams.set('key', settings.tomtom_api_key);
      if (body.country) endpoint.searchParams.set('countrySet', String(body.country).toUpperCase());
      endpoint.searchParams.set('limit', '1');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let response: Response;
      try { response = await fetch(endpoint, { signal: controller.signal }); }
      catch (error) { if (error instanceof DOMException && error.name === 'AbortError') throw new Error('TomTom-geocodering reageerde niet binnen 15 seconden.'); throw error; }
      finally { clearTimeout(timeout); }
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
