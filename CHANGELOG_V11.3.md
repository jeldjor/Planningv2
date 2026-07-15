# Changelog Planning-GJsystems v11.3.0

## Routeberekening en status

- Een ongewijzigde, volledig groene dag krijgt een stabiele invoerhash. De app gebruikt de opgeslagen TomTom-route opnieuw en berekent niet opnieuw zolang volgorde, adressen, coördinaten, tijden, thuisadres, pauze, parkeren en afwezigheid gelijk zijn.
- De laptop wist bij een gewone synchronisatie niet langer alle opgeslagen dagroutes. Daardoor springen correct berekende groene dagen niet zonder wijziging terug naar rood.
- Laptop en iPhone laden de centrale `app_day_settings` opnieuw uit Supabase en gebruiken dezelfde dagstatus, terugrit, kilometers en reistijd.
- De laptop-dagroute toont per traject de opgeslagen `route_live`, `reistijd_min`, `afstand_km` en `parking_min`. De terugrit komt uit dezelfde centrale dagstatus.
- Een rode trajectstatus betekent nu uitsluitend dat voor dat traject geen bevestigde live TomTom-uitkomst is opgeslagen; een groene dag en de geopende dagroute gebruiken dezelfde bron.

## Database en coördinaten

- Iedere klantregel heeft een locatiebolletje: groen voor geldige opgeslagen coördinaten, oranje voor automatisch gevonden coördinaten en rood voor ontbrekende of ongeldige coördinaten.
- Boven de database staan filters voor **Alle klanten**, **Actief** en **Inactief**.
- Het wijzigen van de kolom **Actief** wordt direct in Supabase opgeslagen en verplaatst de klant meteen naar de juiste gefilterde lijst.
- De Excel-import controleert alle latitude- en longitudevelden vóór upload, probeert ongeldige adressen automatisch via de bestaande TomTom-geocodering te herstellen en stopt met een duidelijke melding zolang rode regels overblijven.
- Een actieve klant met ongeldige coördinaten kan niet ongemerkt worden opgeslagen.

## Opdracht afronden en historie

- Laptop en iPhone gebruiken één nieuwe atomaire Supabase-functie `complete_visit`.
- De database leidt het echte klant-UUID af uit de planning. Een zichtbaar klantnummer zoals `AUTO-...` kan daardoor nooit meer per ongeluk in een UUID-kolom worden geschreven.
- Planningstatus en historie worden in één transactie opgeslagen. Bij een fout wordt niets half opgeslagen.
- De unieke koppeling tussen planning en historie voorkomt een dubbel historisch bezoek bij opnieuw klikken of een vertraagde verbinding.
- Grote bezoekfoto's en iPhone-formaten worden vóór upload automatisch naar een hoogwaardige JPEG van maximaal circa 8 MB verkleind. Kleine JPEG-, PNG- en WebP-foto's blijven ongewijzigd en dezelfde originele foto wordt niet dubbel opgeslagen.

## Interface

- De velden **Van** en **Tot en met** staan in Overzicht en Historie compact naast elkaar en vallen alleen op een zeer smal scherm onder elkaar.
- De laptop is expliciet uitgesloten van apparaatlocatie: hij toont geen toestemmingsvenster, vraagt geen browsertoestemming en leest of verzendt nooit de locatie van de laptop. Beheer van iPhone-locaties blijft op de laptop wel beschikbaar.
- De releasecache en GitHub Pages-workflow zijn bijgewerkt naar v11.3.0.

## Nieuwe of gewijzigde bestanden

- `planning-core.js`
- `laptop.html`
- `mobile.html`
- `v11.js`
- `v113.js` (nieuw)
- `v113.css` (nieuw)
- `service-worker.js`
- `runtime-config.js`
- `.github/workflows/deploy-development-pages.yml`
- `scripts/prepare-dist.mjs`
- `SUPABASE_V11_3_RELEASE.sql` (nieuw)
- `tests/release-v11_3.test.mjs` (nieuw)
- bestaande release- en beveiligingstests
- `README.md`
- `package.json`
- `package-lock.json`
