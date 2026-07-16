# Changelog v11.3.1

- De centrale dagengine geeft per bezoek nu `waitingMin` terug.
- Wachttijd vóór een bezoek wordt in `app_day_settings.settings.day_route.visitWaits` opgeslagen; er is geen databaseschemawijziging nodig.
- De iPhone-dagroute toont alleen bij een positieve wachttijd een gele regel, bijvoorbeeld `⏳ Wachttijd 18 min`.
- Wachttijd blijft na synchroniseren, Realtime-updates en opnieuw inloggen zichtbaar.
- De bestaande huis-klanten-huisafstand, TomTom-reistijd, parkeerbuffer, openingstijden en bezoekvolgorde blijven ongewijzigd leidend.
- Cache- en assetversies zijn verhoogd om vermenging met v11.3.0 te voorkomen.
- Een bestaand uitgevoerd of niet-uitgevoerd bezoek kan op laptop en iPhone een andere werkelijke uitvoeringsdatum krijgen. De oorspronkelijke planningsdatum verandert niet en er ontstaat geen dubbele historie.
- De iPhone gebruikt één knop `Kies foto`; iOS toont vervolgens camera, fotobibliotheek en bestanden.
- De knop `Foto verwijderen` verwijdert zowel nog niet opgeslagen selecties als reeds opgeslagen bezoekfoto’s na bevestiging.
- PDF-foto’s worden vóór genereren opnieuw gedecodeerd met EXIF-oriëntatie, waardoor iPhone-foto’s niet meer gedraaid in het verslag verschijnen.
- Winkelbezoek-PDF’s tonen alleen de bezoekdatum en nooit start- of eindtijd.
- Van Haren, Bomont, DAKA, E5, Molecule, Torfs, Veritas en Berden gebruiken de goedgekeurde banner en het eigen kleurprofiel.
- Een iPhone-afwezigheid kan nu correct op dezelfde dag worden opgeslagen, bijvoorbeeld 08:00–10:00; de eerdere automatische volgende einddatum is verwijderd.
- Bestaande afwezigheid kan op iPhone worden gewijzigd of na bevestiging worden verwijderd.
- Na toevoegen, wijzigen of verwijderen van afwezigheid wordt iedere betrokken dagroute direct opnieuw live berekend, inclusief thuis-naar-eerste-klant.
- Historie haalt de klantnaam nu rechtstreeks via de `visit_history.customer_id`-relatie op; `Klant` verschijnt alleen nog als de klant echt verwijderd of onbekend is.
- Bestaande planningregels met `Uitgevoerd` zonder bijbehorende historierij worden bij de migratie veilig teruggezet op `Gepland`.
- Een uitgestelde databasecontrole voorkomt voortaan dat gewone route- of planningssync een opdracht op `Uitgevoerd` zet; dit mag alleen via `complete_visit` met historie.

## Gewijzigde bestanden

- `planning-core.js`
- `mobile.html`
- `laptop.html`
- `v11.js`
- `v113.js`
- `v110.js`
- `visit-pdf.js`
- `assets/chain-banners.png`
- `SUPABASE_V11_3_1_RELEASE.sql`
- `INSTALLATIE_V11.3.1.md`
- `service-worker.js`
- `package.json`
- `package-lock.json`
- `README.md`
- relevante regressietests

## Supabase

Voor de wachttijd is geen nieuwe kolom nodig; deze staat in het bestaande JSON-veld voor daginstellingen. Voer `SUPABASE_V11_3_1_RELEASE.sql` één keer uit om een bestaande bezoekhistorie veilig te kunnen bewerken.
