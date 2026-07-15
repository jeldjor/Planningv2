# Planning-GJsystems v11.3.0

Deze productierelease maakt de centrale route-, database- en historielaag stabiel voor dagelijks gebruik. v11.3.0 houdt een ongewijzigde groene route groen zonder opnieuw TomTom aan te roepen, controleert klantcoördinaten vóór planning en import en rondt bezoeken op laptop en iPhone atomair af.

## Belangrijkste verbeteringen

- Live dagroutes worden van het ingestelde thuisadres via alle klanten en terug naar huis berekend. Afstand, rijtijd, bezoektijden en de groene live-status komen op laptop en iPhone uit dezelfde berekening.
- Een gewijzigde volgorde, bezoek- of vertrektijd berekent en bewaart direct de volledige dag opnieuw.
- `Route optimaliseren` kiest een efficiënte volgorde en berekent daarna alle TomTom-trajecten opnieuw.
- Een complete dag wordt met één gecontroleerde databasebewerking verplaatst. Daardoor springt de dag niet meer terug na Realtime-synchronisatie.
- Afwezigheid, pauze, parkeertijd en terugrit worden in de dagtijdlijn verwerkt.
- De mobiele app toont openstaande opdrachten in Overzicht, heeft een aparte Historie en kan een niet-uitgevoerd bezoek als nieuwe opdracht herplannen zonder de historie te wijzigen.
- Laptopfilters voor Overzicht en Historie hebben een start- en einddatum.
- Realtime werkt met gerichte rij-updates en samengevoegde synchronisatieverzoeken, zodat niet na iedere wijziging de hele applicatie opnieuw wordt opgebouwd.
- Bezoekfoto's en profielfoto's worden privé opgeslagen en met aangemelde downloads of tijdelijke signed URL's gelezen. Dubbele fotopaden worden door de database geblokkeerd.
- De bestaande PDF-knop maakt een professioneel dynamisch winkelbezoekrapport voor laptop en iPhone.
- Het zichtbare development-/versielabel is verwijderd en de mobiele pagina kan niet per ongeluk worden ingezoomd.
- Alleen het e-mailadres kan worden onthouden; wachtwoorden worden nooit in browseropslag bewaard.
- Beheer toont alle gebruikers bij Live Locaties, ook als er nog geen positie is. Een beheerder kan per gebruiker een sessie van 30 minuten live volgen starten; de actieve app vraagt dan iedere minuut een positie op.
- Ongewijzigde groene dagen worden aan de hand van een invoerhash hergebruikt. Alleen een routebepalende wijziging start een nieuwe complete TomTom-berekening.
- De database toont locatiekwaliteit en filters voor alle, actieve en inactieve klanten; import controleert ontbrekende coördinaten vóór upload.
- Afronden gebruikt de atomaire RPC `complete_visit`, zodat een klantnummer nooit meer in een UUID-veld terechtkomt en planning en historie niet half kunnen worden opgeslagen.

## Installeren of bijwerken

Maak eerst een databaseback-up en test op een afzonderlijke Supabase-ontwikkelomgeving.

### Bestaande database

1. Maak eerst een databaseback-up.
2. Als v11-core nog niet is geïnstalleerd: voer `SUPABASE_V11_0_CORE.sql` uit.
3. Voer daarna `SUPABASE_V11_1_RELEASE.sql` uit als dat nog niet is gebeurd.
4. Voer `SUPABASE_V11_2_RELEASE.sql` uit als dat nog niet is gebeurd.
5. Voer daarna `SUPABASE_V11_3_RELEASE.sql` uit. Dit voegt de atomaire bezoekafronding en unieke historiekoppeling toe.
6. Deploy de meegeleverde Edge Function `tomtom-proxy` als v11.2 nog niet actief was.
7. Bouw en publiceer de app en voer de live acceptatiepunten uit.

De releasemigraties zijn herhaalbaar en voegen de benodigde kolommen, indexen, private Storage-regels en beveiligde RPC's toe:

- `save_user_app_settings`
- `save_day_route`
- `replan_history_visit`
- `move_planning_day`
- `complete_visit`

### Nieuw, leeg Supabase-project

Voer in deze volgorde uit: `SUPABASE_V10_7_DEV_BASELINE.sql`, `SUPABASE_V11_1_RELEASE.sql`, `SUPABASE_V11_2_RELEASE.sql` en `SUPABASE_V11_3_RELEASE.sql`.

Maak geen gebruikers, wachtwoorden, service-role-key of productiegegevens onderdeel van de repository.

## Configuratie en bouwen

Kopieer `.env.example` naar `.env` en vul de waarden van de ontwikkelomgeving in:

```text
APP_ENV=development
APP_DEPLOYMENT_LABEL=Planning-GJsystems
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-of-publishable-key>
SUPABASE_PROJECT_REF=<project-ref>
MAP_PROVIDER=openstreetmap
```

Voer daarna uit:

```bash
npm ci
npm run config:generate
npm test
npm run test:pdf
npm run build
```

`runtime-config.js`, `.env` en `dist/` worden niet gecommit. `runtime-config.js` mag uitsluitend een anon/publishable key bevatten. De service-role-key en TomTom-key blijven in Supabase Secrets.

## Route- en tijdarchitectuur

`planning-core.js` is de gedeelde engine voor laptop en mobiel. De volledige dag bestaat uit:

1. thuisadres naar eerste bezoek;
2. alle bezoeken in de actuele volgorde;
3. eventuele afwezigheid, pauze en parkeerbuffer;
4. laatste bezoek terug naar huis.

De frontend vraagt de trajecten in één batch op bij `tomtom-proxy`. Alleen wanneer ieder traject live is ontvangen, krijgt de dag een live-status. `save_day_route` controleert het aantal actuele planningregels en slaat alle volgorden, tijden, kilometers, vervoersmodi en route-statussen atomair op.

Het thuisadres, de coördinaten, parkeerbuffer en loopgrens worden centraal in Instellingen opgeslagen. Er staat geen vaste woonlocatie in de routecode.

## Dynamische winkelbezoek-PDF

De bestaande PDF-knop gebruikt `visit-pdf.js`. Ketenherkenning gebruikt primair `customers.keten`, normaliseert hoofdletters, accenten en leestekens en kiest daarna een profiel. De winkelnaam bepaalt de template niet.

Beschikbare profielen:

- de Bijenkorf
- Scapino
- INNO
- INTERSPORT
- Van Tilburg Sport
- Stichd als algemene terugvaltemplate

Een nieuw profiel wordt als één configuratieobject aan `chainProfiles` toegevoegd. Zonder goedgekeurd logo toont de generator een tekstheader in de ketenkleuren; een ontbrekende afbeelding verschijnt nooit als kapot element.

De generator gebruikt bestaande data uit `visit_history`, `planning`, `customers`, `profiles` en `visit_photos`. Lege velden worden verborgen. Foto's worden uit de private bucket `visit-photos` gedownload en, indien nodig, met een signed URL van vijf minuten opgehaald. Een ontbrekende foto wordt veilig overgeslagen. Lange tekst en meer dan acht foto's lopen automatisch door op een vervolgpagina.

Zie `PDF_README_V11.0.md` voor de veldmapping en uitbreidingsinstructies. De map `output/pdf` bevat de veertien gegenereerde controlescenario's.

## Synchronisatie en historie

- Wijzigingen worden eerst centraal opgeslagen en daarna lokaal bevestigd.
- Realtime verwerkt alleen het gewijzigde record en voegt snel opeenvolgende signalen samen.
- Een niet-uitgevoerd historisch bezoek blijft als bewijs in `visit_history` staan. Herplannen maakt een nieuwe `planning`-rij met `rescheduled_from_history_id`.
- Historie- en overzichtslijsten laden begrensde pagina's om trage volledige tabelrenders te voorkomen.
- De service worker bewaart alleen de statische app-shell. Runtimeconfiguratie en Supabase-data worden nooit gecachet.

## Teststatus en productieacceptatie

De repository bevat geautomatiseerde integratie-, beveiligings-, route-, UI- en PDF-tests. De uiteindelijke testresultaten staan in `TESTCONTROLE_V11.0.md`.

De geautomatiseerde suite controleert code, simulaties, beveiligingscontracten, PDF's en builds. Een echte iPhone, laptop, TomTom-account en gekoppeld Supabase-project zijn niet beschikbaar in de bouwomgeving. De gemarkeerde live acceptatiepunten moeten daarom één keer op de eigen omgeving worden bevestigd; achtergrondlocatie op iOS kan door iOS worden gepauzeerd wanneer de PWA niet zichtbaar of het toestel vergrendeld is.

## Documentatie

- `CHANGELOG_V11.0.md` – alle functionele wijzigingen en gewijzigde bestanden
- `TESTCONTROLE_V11.0.md` – uitgevoerde tests en nog vereiste live acceptatie
- `PDF_README_V11.0.md` – ketenprofielen, velden en foto-ophaalwijze
- `SUPABASE_V11_0_CORE.sql` – migratie voor een bestaande v10.11-database
- `SUPABASE_V11_1_RELEASE.sql` – Live Locaties, 30 minuten live volgen en v11.1-herstel
- `SUPABASE_V11_3_RELEASE.sql` – atomaire bezoekafronding en unieke historiekoppeling
- `CHANGELOG_V11.3.md` – functionele wijzigingen en gewijzigde bestanden
- `TESTCONTROLE_V11.3.md` – werkelijk uitgevoerde tests en vijf live controles
- `INSTALLATIE_V11.3.md` – stappen voor de huidige GitHub- en Supabase-omgeving
- `SUPABASE_V10_7_DEV_BASELINE.sql` – complete baseline voor een nieuw leeg project
- `supabase/functions/README.md` – deploy-informatie voor de Edge Functions

Oudere changelogs en controledocumenten blijven aanwezig als versiehistorie.
