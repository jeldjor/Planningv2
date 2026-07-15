# Changelog Planning-GJsystems v11.2.0

## Hoofdoplossing

- De werkelijk actieve Supabase `tomtom-proxy` bleek niet gelijk aan de GitHub-bron en gaf in 36 van de 100 recente aanroepen HTTP 500. De geteste functie is als actieve versie 11 gepubliceerd.
- Laptop en iPhone gebruiken nu één centrale `route-batch` per dag. Losse routecycli en de losse mobiele trajectopslag zijn verwijderd.
- De routefunctie heeft begrensde paralleliteit, time-outs, maximaal drie pogingen bij tijdelijke TomTom-storingen, coördinatenvalidatie en een stabiel foutcontract met foutcode en request-id.
- De iPhone start bij inloggen niet meer automatisch een externe routeberekening. Een routefout kan daardoor niet meer als fout bij het laden van de planning verschijnen.

## Database en synchronisatie

- `save_day_route` slaat uitsluitend een groene dag op als ieder klanttraject en de terugrit live zijn ontvangen.
- Dagtotalen bevatten expliciet `includesReturn=true`; laptop en iPhone vertrouwen niet meer blind op oudere dagtotalen zonder terugritbewijs.
- Een bestaande tegenstrijdige dagstatus is veilig gecorrigeerd: de onderliggende bezoeken blijven ongewijzigd, maar de dag wordt rood totdat hij opnieuw live is berekend.
- Triggerfuncties zijn niet meer rechtstreeks uitvoerbaar door anonieme of aangemelde browserrollen.
- De dubbele RLS-selectpolicy op gebruikersinstellingen is opgesplitst en ontbrekende foreign-key-indexen zijn toegevoegd.

## Stabiliteit en release

- Routeopslag heeft een expliciete client-time-out en routeberekening is per datum vergrendeld.
- Cacheversies zijn verhoogd naar `112000`; de app-shellcache heet `planning-gjsystems-shell-v11.2.0`.
- De GitHub Pages-workflow gebruikt Node.js 24 en de v11.2.0-deploymentnaam.
- De complete regressieset is uitgebreid naar 72 tests.

## Gewijzigde of nieuwe bestanden

- `.github/workflows/deploy-development-pages.yml`
- `planning-core.js`
- `laptop.html`
- `mobile.html`
- `v109.js`
- `v11.js`
- `service-worker.js`
- `runtime-config.js`
- `supabase/functions/tomtom-proxy/index.ts`
- `supabase/functions/README.md`
- `SUPABASE_V11_2_RELEASE.sql` (nieuw)
- `README.md`
- `package.json`
- `package-lock.json`
- `tests/release-v11_2.test.mjs` (nieuw)
- bestaande release- en securitytests voor v11.2.0

