# Changelog Planning-GJsystems v11.1.2

## Hotfix 11.1.2

- Ook adrescontrole, bezoeken indelen, planning opslaan en centraal terugladen tonen nu hun eigen voortgang.
- Adrescontrole stopt na 15 seconden, planning opslaan na 20 seconden en terugladen na 20 seconden.
- De totale voorbereidende generatie wordt na twee minuten gecontroleerd afgebroken.
- De generator geeft tijdens het indelen na ieder bezoek de browser ruimte om het scherm te verversen.
- Een tweede klik tijdens genereren wordt geblokkeerd.
- Het voortgangsvenster sluit vanuit één centrale `finally`, ongeacht in welke fase een fout ontstaat.
- TomTom blijft beschikbaar voor ontbrekende klantcoördinaten; alleen de verouderde routevoorberekening wordt overgeslagen.

## Hotfix 11.1.1

- Een ontbrekende timeout rond `save_day_route` is toegevoegd.
- TomTom heeft een deadline van 25 seconden, Supabase-routeopslag 15 seconden en de complete dag 45 seconden.
- Het voortgangsvenster sluit altijd via `finally`; een dag kan niet onbeperkt op “1 van 4” blijven staan.
- Nieuwe regressietest met een bewust nooit antwoordende netwerkcall.

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
- De app-shellcache is verhoogd naar v11.1.0.
- Gebruikersaanmaak rolt een Auth-account terug als het profiel niet kan worden opgeslagen; beheerders kunnen niet-admin testgebruikers veilig verwijderen.
- TomTom-geocodering heeft nu invoergrenzen en een timeout van 15 seconden.
- TomTom-dagroutes, Supabase-routeopslag en de complete dagbewerking hebben afzonderlijke harde deadlines; het voortgangsvenster kan niet onbeperkt op dag 1 blijven staan.

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
