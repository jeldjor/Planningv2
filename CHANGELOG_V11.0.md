# Changelog Planning-GJsystems v11.0

## Correctie v11.0.1

- Planning genereren slaat nieuwe regels eerst in Supabase op en start pas daarna de live routeberekening met echte database-ID's.
- Het voortgangsvenster sluit nu altijd, ook wanneer TomTom of de Edge Function een fout geeft.
- Route-batchverzoeken hebben een duidelijke time-out in frontend en Edge Function, zodat het scherm niet onbeperkt blijft hangen.
- Cacheversies zijn verhoogd zodat laptop en iPhone de correctie direct ophalen.

## Route, tijd en planning

- Eén gedeelde dagengine toegevoegd voor laptop en iPhone.
- Alle dagtotalen omvatten thuis, alle klanten en de terugrit naar huis.
- Live TomTom-batchberekening toegevoegd; alleen volledig live berekende dagen worden groen.
- Planning genereren berekent na het ophalen van de echte database-ID's direct iedere nieuwe dag live.
- Een wijziging van volgorde, bezoekduur, bezoektijd of vertrektijd berekent de hele dag opnieuw.
- `Tijden` op mobiel is vervangen door `Route optimaliseren`.
- Afwezigheid, pauze, parkeerbuffer en thuisrit worden in tijden en totalen verwerkt.
- Complete dagverplaatsing vervangen door de atomaire RPC `move_planning_day`.
- Centrale instellingen voor startadres, startcoördinaten, parkeerbuffer en loopgrens toegevoegd.

## Synchronisatie en prestaties

- Volledige herladingen na ieder Realtime-event vervangen door gerichte recordupdates.
- Gelijktijdige lokale mutaties en Realtime-updates worden gescheiden en samengevoegd.
- Alleen het actieve scherm wordt opnieuw gerenderd.
- Mobiele historie heeft paginering; grote laptoplijsten hebben een veilige rendergrens.
- Service worker herbouwd als veilige app-shellcache zonder runtimeconfiguratie of Supabase-data.

## Mobiel

- Dagtotalen gelijkgetrokken met laptop: klanten, kilometers, reistijd en afgerond/totaal.
- Donkerrode knop `Uit planning` met zilverkleurige tekst.
- Afwezigheid zichtbaar in kalenderdetails en meegenomen in toekomstige dagroutes.
- Overzicht toont standaard alleen niet-uitgevoerde opdrachten.
- Klanten kunnen vanuit zoeken naar vandaag worden verplaatst of toegevoegd.
- Nieuwe module Historie met details, foto's en herplannen van niet-uitgevoerde opdrachten.
- Niet-uitgevoerde historie blijft ongewijzigd; herplannen maakt een gekoppelde kopie.
- PDF-knop toegevoegd aan uitgevoerde en niet-uitgevoerde bezoekkaarten.
- Onbedoeld in- en uitzoomen uitgeschakeld.

## Laptop

- Start- en einddatum toegevoegd aan Overzicht en Historie.
- Dagstatistieken gebruiken dezelfde centrale dagroute als mobiel.
- Herplannen van een niet-uitgevoerd historisch bezoek toegevoegd.
- Private foto-URL's en begrensde lijstrendering toegevoegd.
- Onderste logo groter en passend gemaakt zonder zijbalkscroll.

## Status en foto's

- Afgeronde en niet-uitgevoerde status wordt vanuit de opgeslagen historie als leidend behandeld.
- Reden van niet uitvoeren heeft een eigen databaseveld.
- Dubbele foto-opslag voorkomen met stabiele uploadpaden en een unieke database-index.
- `visit-photos` en `profile-photos` privé gemaakt met gebruikers- en beheerdersbeleid.
- Profielfototekst en afbeelding blijven gecentreerd in het ronde kader.

## PDF

- Configureerbare generator met profielen voor Bijenkorf, Scapino, INNO, INTERSPORT, Van Tilburg Sport en Stichd.
- Ketenherkenning gebruikt primair `customers.keten`.
- Dynamische A4-layout, tweekoloms gegevens, nul tot acht foto's per fotopagina en automatische vervolgpagina's.
- Niet-uitgevoerd-reden, samenvatting, werkzaamheden, aandachtspunten en vervolgactie worden alleen getoond wanneer aanwezig.
- Beveiligde foto-download en signed URL-terugval toegevoegd.
- iOS-voorbeeldvenster toegevoegd om delen en bewaren mogelijk te houden.

## Beveiliging en database

- Wachtwoorden worden niet meer in `localStorage` bewaard; oude opgeslagen wachtwoorddata wordt opgeschoond.
- Nieuwe RPC's `save_user_app_settings`, `save_day_route`, `replan_history_visit` en `move_planning_day` toegevoegd als `SECURITY INVOKER`.
- Route-revisie, vaste starttijd, herkomsthistorie en rapportagevelden toegevoegd.
- Complete nieuwe-projectbaseline bijgewerkt naar dezelfde v11.0-contracten.

## Gewijzigde of nieuwe bestanden

- `planning-core.js`, `v11.js`, `v11.css`, `service-worker.js`
- `laptop.html`, `mobile.html`, `auth.js`, `v109.js`, `v110.js`, `v108.js`, `v111.js`, `v111.css`
- `visit-pdf.js`, `PDF_README_V11.0.md`
- `SUPABASE_V11_0_CORE.sql`, `SUPABASE_V10_7_DEV_BASELINE.sql`
- `supabase/functions/tomtom-proxy/index.ts`, `supabase/functions/README.md`
- `scripts/prepare-dist.mjs`, `scripts/generate-pdf-test-cases.mjs`
- `tests/release-v11.test.mjs` en bestaande regressietests
- `README.md`, `TESTCONTROLE_V11.0.md`, `CHANGELOG_V11.0.md`
- `.env.example`, `runtime-config.example.js`, `package.json`, `package-lock.json`

De bestaande v10.11-bronmap is niet aangepast.
