# Changelog Planning-GJsystems v11.1.2

## Opgeloste fouten

- Live Locaties op mobiel staat nu als direct beheerpaneel en verdwijnt niet meer door een verborgen bovenliggend Gebruikers-paneel.
- Een duidelijke foutmelding verschijnt wanneer de Live Locaties-migratie of RPC ontbreekt.
- Beheer kan per gebruiker 30 minuten live volgen starten en stoppen. De actieve app vraagt tijdens de sessie iedere minuut een positie op.
- Gewone synchronisatie start niet langer een TomTom-herberekening voor alle geplande dagen.
- Planning genereren berekent de live routes pas nadat de planning atomair is opgeslagen en de echte database-ID's zijn geladen.
- Een complete dag wordt database-eerst verplaatst en daarna opnieuw live berekend.
- Laptop en iPhone Realtime zijn per actieve `user_id`/werkruimte gefilterd.
- Laptopafronding schrijft status, historie en foto's nu naar Supabase voordat de lokale weergave wordt bevestigd.
- De dubbele laptop-koppeling van de knop Bezoek opslaan is verwijderd en gelijktijdig dubbel opslaan wordt geblokkeerd.
- Mobiele afronding herstelt de oude lokale status wanneer centrale opslag mislukt.
- Fotopaden zijn deterministisch; een bestaand bestand of bestaande koppeling wordt niet dubbel toegevoegd.
- iPhone gebruikt voor kilometers en reistijd uitsluitend het centrale dagtotaal thuis-klanten-thuis. Een onvolledig lokaal deeltotaal wordt niet meer als 0 getoond.
- Een ochtendafwezigheid verschuift de route na de afwezigheid, tenzij er expliciet een vaste afspraak ervoor staat.
- De oude v10.11 DEV-module wordt niet meer geladen; het korte verkeerde versie-/developmentbeeld is weg.
- Alle gewijzigde scripts hebben cacheversie `111200` en de app-shellcache is verhoogd naar v11.1.2.
- Geldige live TomTom-batchresultaten uit een oudere Edge Function zonder expliciet `live=true` worden veilig herkend; ongeldige afstand of reistijd wordt juist afgewezen.
- Het routevoortgangsvenster sluit vóórdat een foutmelding verschijnt.
- Identieke of vrijwel identieke klantlocaties worden als een geldig traject van één minuut verwerkt zonder een onmogelijke TomTom-aanvraag.
- Wanneer de batch tijdelijk wordt geweigerd, probeert de app de trajecten gecontroleerd één voor één en noemt een fout voortaan het exacte trajectnummer.
- De TomTom Edge Function verwerkt batchtrajecten sequentieel om piek-/rate-limitfouten te voorkomen.
- TomTom-routefouten komen als leesbaar functieantwoord terug; de kale Supabase-melding `Edge Function returned a non-2xx status code` wordt niet meer als route- of laadfout gebruikt.
- De iPhone laadt de planning onafhankelijk van de automatische TomTom-herberekening. Een tijdelijke routefout blokkeert het inloggen en de planning niet meer.
- Een recente locatie voorkomt nieuwe GPS-vragen bij iedere focus of heropening; gegeven app-toestemming wordt per gebruiker onthouden.
- Gebruikersaanmaak rolt een Auth-account terug als het profiel niet kan worden opgeslagen; beheerders kunnen niet-admin testgebruikers veilig verwijderen.
- TomTom-geocodering heeft nu invoergrenzen en een timeout van 15 seconden.

## Database

- Nieuw: `SUPABASE_V11_1_RELEASE.sql`.
- Nieuw: complete Live Locaties-tabellen, RLS, RPC's en Realtime-configuratie.
- Nieuw: `set_user_live_tracking` met maximaal 30 minuten.
- Nieuw: `replace_planning_period` voor transactionele vervanging van een planningsperiode.

## Gewijzigde hoofdbestanden

- `laptop.html`, `mobile.html`
- `planning-core.js`, `v108.js`, `v110.js`, `v11.js`
- `service-worker.js`
- `supabase/functions/admin-users/index.ts`
- `supabase/functions/tomtom-proxy/index.ts`
- `SUPABASE_V11_1_RELEASE.sql`
- `README.md`, `package.json`, `package-lock.json`
- tests onder `tests/`

De bestaande dynamische PDF-generator en ketenprofielen zijn ongewijzigd gebleven en volledig opnieuw getest.
