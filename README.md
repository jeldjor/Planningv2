# Planning-GJsystems v10.8 – Live Locaties

Dit is een zelfstandige development/testversie, inhoudelijk gebaseerd op `Planning-GJsystems v10.7 COMPLETE`. Gebruik deze repository uitsluitend met een **nieuw, leeg Supabase development/testproject**. De productie-repository, productie-app en productiedatabase horen niet bij deze installatie.

## Architectuur

- `auth.js` gebruikt één echte Supabase-sessie en houdt de echte `auth.uid()` gescheiden van de eventueel voorgedane werkruimte.
- `v108.js` bevat één gedeelde locatiemanager voor laptop en iPhone/PWA. Deze beheert toestemming, één timer, voorgrondupdates, Realtime en fallback.
- Locaties worden uitsluitend via RPC's zonder vrij `user_id` geschreven. PostgreSQL bepaalt de eigenaar met `auth.uid()`.
- `location_system_settings` bevat de centrale schakelaar en frequentie. De installatie start altijd met Live Locaties **Uit** en 10 minuten.
- `user_live_locations` bevat één laatst ontvangen punt per gebruiker; `user_location_history` bevat maximaal de functioneel gebruikte 24-uursperiode.
- De beheerkaart gebruikt Leaflet en OpenStreetMap. Hiervoor is geen geheime kaartkey nodig.
- Beheer van Auth-gebruikers en de TomTom-proxy draaien als Supabase Edge Functions. De service-role-key blijft uitsluitend server-side.

## Veilige uitvoervolgorde

1. Maak een nieuwe GitHub-repository, bijvoorbeeld `Planning-GJsystems-v10.8-live-locations`, en plaats uitsluitend de inhoud van deze map daarin.
2. Maak een nieuw Supabase development/testproject. Noteer de nieuwe project-ref, project-URL en anon/publishable key. Gebruik nergens productiegegevens.
3. Open in het **nieuwe project** de SQL Editor en voer [SUPABASE_V10_7_DEV_BASELINE.sql](SUPABASE_V10_7_DEV_BASELINE.sql) uit. Dit maakt de tabellen en beveiliging die een lege v10.7-testomgeving nodig heeft.
4. Maak in Authentication handmatig drie testaccounts: één beheerder, gebruiker A en gebruiker B. Zet geen wachtwoorden in repositorybestanden.
5. Controleer de aangemaakte rijen in `public.profiles`. Promoveer alleen het bedoelde testaccount in de SQL Editor van het testproject:

   ```sql
   update public.profiles
   set role = 'admin', updated_at = now()
   where id = '<UUID-VAN-TESTBEHEERDER>';
   ```

6. Voer daarna [SUPABASE_V10_8_LIVE_LOCATIONS_DEV.sql](SUPABASE_V10_8_LIVE_LOCATIONS_DEV.sql) uit. Deze migratie laat Live Locaties standaard uitstaan.
7. Deploy de functies `admin-users` en `tomtom-proxy` uit `supabase/functions`. Koppel de Supabase CLI uitsluitend nadat de project-ref zichtbaar is gecontroleerd als de nieuwe testproject-ref. Zie [supabase/functions/README.md](supabase/functions/README.md).
8. Activeer de cleanup pas na controle desgewenst handmatig met [SUPABASE_V10_8_LOCATION_CLEANUP_CRON_OPTIONAL.sql](SUPABASE_V10_8_LOCATION_CLEANUP_CRON_OPTIONAL.sql). De hoofd-migratie plant geen cronjob in.
9. Configureer en deploy de nieuwe app op een eigen development-URL.
10. Voer de nog openstaande echte project- en iPhone-tests uit volgens [CONTROLELIJST_V10.8.md](CONTROLELIJST_V10.8.md). Zet productie pas na afzonderlijke goedkeuring in een later migratietraject.

Er is vanuit deze oplevering geen SQL uitgevoerd en geen Supabase-project gekoppeld.

## Configuratie

Kopieer `.env.example` naar een lokaal `.env`-bestand en vul alleen waarden van het nieuwe testproject in:

```text
APP_ENV=development
APP_DEPLOYMENT_LABEL=Planning-GJsystems v10.8 DEV
SUPABASE_URL=https://<nieuwe-project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-of-publishable-key-van-het-testproject>
SUPABASE_PROJECT_REF=<nieuwe-project-ref>
MAP_PROVIDER=openstreetmap
```

Genereer daarna de niet-gecommitte runtimeconfiguratie en bouw de distributiemap:

```bash
npm ci
npm run config:generate
npm test
npm run build
```

`runtime-config.js`, `.env` en `dist/` worden niet gecommit. De app weigert te starten bij ontbrekende configuratie, een afwijkende project-ref, een productieomgeving of een service-role-JWT. De browser ontvangt nooit een service-role-key.

Voor GitHub Pages gebruikt de workflow uitsluitend deze repositorysecrets:

- `DEV_SUPABASE_URL`
- `DEV_SUPABASE_ANON_KEY`
- `DEV_SUPABASE_PROJECT_REF`

Controleer vóór iedere deployment dat deze drie waarden bij hetzelfde nieuwe testproject horen. Gebruik een aparte deployment-URL; overschrijf de bestaande productie-URL niet.

## Realtime

De migraties voegen de benodigde tabellen herhaalbaar toe aan `supabase_realtime`. Controleer in het testproject dat Realtime aanstaat voor:

- `location_system_settings`
- `user_location_settings`
- `user_live_locations`

Bij uitval haalt de app de centrale instelling en beheerlocaties iedere 60 seconden opnieuw op. Subscriptions en fallbacktimers worden bij uitloggen verwijderd.

## Kaart

De kaart gebruikt Leaflet 1.9.4 en OpenStreetMap-tiles. Er is geen browsergeheim of serverkey nodig. Voor een publieke toepassing met veel kaartverkeer moet vóór productie een passende tileprovider en gebruiksbeleid worden gekozen; dat is onderdeel van het latere productieplan.

## Cleanup van 24 uur

De migratie maakt `public.cleanup_location_history()` en geeft alleen `service_role` uitvoerrecht. Automatische scheduling is bewust niet actief. Na handmatige uitvoering van het optionele cronbestand verwijdert Supabase ieder uur historie die ouder is dan de centrale bewaartermijn (v10.8: 24 uur). Controleer dit in `cron.job` en voer een test met oude testdata uit voordat dit als geslaagd wordt afgevinkt.

## Testaccounts en testdata

- Maak accounts alleen via Authentication of via de gedeployde `admin-users`-functie.
- Maak uitsluitend de beheerder admin in de bestaande centrale bron `profiles.role`.
- Gebruik verschillende testklanten en planningen voor A en B om werkruimtescheiding te controleren.
- Gebruik geen echte klantgegevens, locaties of wachtwoorden.

## Web/PWA-beperking

iOS mag een web/PWA volledig pauzeren. De app probeert volgens het ingestelde interval te verzenden zolang uitvoering mogelijk is en direct bij openen of terugkeer naar de voorgrond. Zij beweert niet dat iOS in gepauzeerde toestand exact op tijd blijft bijwerken. Beheer toont daarom altijd meettijd, ontvangsttijd, ouderdom, nauwkeurigheid en status.

## Documentatie

- [ANALYSE_EN_BOUWPLAN_V10.8.md](ANALYSE_EN_BOUWPLAN_V10.8.md)
- [CONTROLELIJST_V10.8.md](CONTROLELIJST_V10.8.md)
- [CHANGELOG_V10.8.md](CHANGELOG_V10.8.md)
- [ROLLBACK_EN_PRODUCTIEMIGRATIE.md](ROLLBACK_EN_PRODUCTIEMIGRATIE.md)

