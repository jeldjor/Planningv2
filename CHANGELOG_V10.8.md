# Changelog v10.8.1

## Correcties v10.8.1

- Beheer is op iPhone en laptop alleen zichtbaar en bereikbaar voor de bestaande centrale adminrol.
- De CSS-regel die de mobiele beheerknop voor gewone gebruikers opnieuw zichtbaar maakte is gecorrigeerd.
- Beheer kan Live Locaties nu per gebruiker aan- of uitzetten.
- De database weigert locatieopslag wanneer de beheerder Live Locaties voor die gebruiker niet heeft ingeschakeld.
- Gewone gebruikers zien Routefunctionaliteit niet meer onder Instellingen.
- De toestemmingsflow start alleen wanneer Live Locaties zowel centraal als voor de betreffende gebruiker is ingeschakeld.
- Een apart, herhaalbaar DEV-correctiebestand is toegevoegd voor testprojecten waarop de oorspronkelijke v10.8-migratie al is uitgevoerd.

## Nieuwe functies

- Centrale beheerinstelling Live Locaties, standaard Uit.
- Centrale frequenties 5, 10, 15, 30 en 60 minuten; standaard 10.
- Eenmalige, exact gespecificeerde toestemmingsmelding en officiële browser/iPhone-locatievraag.
- Directe poging bij login/openen, na toestemming en terugkeer naar de voorgrond.
- Eén centrale timer en listenerset met volledige cleanup.
- Eigen actuele locatie plus 24-uurslocatiehistorie.
- Toestemmings- en locatiestatus voor beheerders per gebruiker.
- Responsive beheerweergave op laptop en iPhone met toestemmingsstatus, ouderdom, nauwkeurigheid en Google Maps-link.
- Actuele OpenStreetMap-kaart en historiekaart met filters 1/4/8/24 uur.
- Supabase Realtime met periodieke fallback.

## Database en beveiliging

- Nieuwe test-only v10.7-baseline voor een leeg developmentproject.
- Tabellen `location_system_settings`, `user_location_settings`, `user_live_locations` en `user_location_history`.
- `user_location_settings.admin_enabled` als server-side afgedwongen beheerderkeuze per gebruiker.
- RLS en minimale grants; locatie-RPC's bepalen eigenaar uitsluitend met `auth.uid()`.
- Directe clientwrites naar locatietabellen zijn ingetrokken.
- Beheer-RPC's controleren de bestaande `is_app_admin()`-functie.
- Atomische upsert van laatste locatie en invoeging van historie.
- Cleanupfunctie alleen uitvoerbaar door `service_role`; cron apart en optioneel.
- Edge Functions voor Auth-gebruikersbeheer en TomTom, met servicekey uitsluitend server-side.

## Gewijzigde bestanden

- Gewijzigd: `auth.js`, `index.html`, `laptop.html`, `mobile.html`.
- Nieuw: `app-config.js`, `runtime-config.example.js`, `.env.example`, `.gitignore`, `v108.js`, `v108.css`.
- Nieuw: beide DEV-SQL-bestanden, optionele cron-SQL en Edge Functions.
- Nieuw: `SUPABASE_V10_8_1_ADMIN_PER_USER_LOCATIONS_DEV.sql` voor bestaande v10.8-testinstallaties.
- Nieuw: npm-scripts, tests, GitHub Pages developmentworkflow en documentatie.
- Ongewijzigd: `v105.js`, `v105.css`, `v106.js`, `v106.css` en alle logo-afbeeldingen.

## Bekende beperkingen

- Een iOS-web/PWA kan in de achtergrond volledig worden gepauzeerd; hervatten triggert direct een nieuwe poging.
- De SQL en end-to-end-RLS-tests zijn niet uitgevoerd omdat geen afzonderlijk testproject of lokale Supabase aan deze werkomgeving was gekoppeld.
- Automatische cleanup is pas actief nadat het optionele cronbestand handmatig in het testproject is uitgevoerd.
- OpenStreetMap-standaardtiles zijn geschikt voor development; kies vóór grootschalige productie een provider met passend gebruiksbeleid.
