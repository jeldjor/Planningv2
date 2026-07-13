# Changelog v10.8

## Nieuwe functies

- Centrale beheerinstelling Live Locaties, standaard Uit.
- Centrale frequenties 5, 10, 15, 30 en 60 minuten; standaard 10.
- Eenmalige, exact gespecificeerde toestemmingsmelding en officiële browser/iPhone-locatievraag.
- Directe poging bij login/openen, na toestemming en terugkeer naar de voorgrond.
- Eén centrale timer en listenerset met volledige cleanup.
- Eigen actuele locatie plus 24-uurslocatiehistorie.
- Instellingenstatus voor iedere gebruiker.
- Responsive beheerweergave op laptop en iPhone met toestemmingsstatus, ouderdom, nauwkeurigheid en Google Maps-link.
- Actuele OpenStreetMap-kaart en historiekaart met filters 1/4/8/24 uur.
- Supabase Realtime met periodieke fallback.

## Database en beveiliging

- Nieuwe test-only v10.7-baseline voor een leeg developmentproject.
- Tabellen `location_system_settings`, `user_location_settings`, `user_live_locations` en `user_location_history`.
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
- Nieuw: npm-scripts, tests, GitHub Pages developmentworkflow en documentatie.
- Ongewijzigd: `v105.js`, `v105.css`, `v106.js`, `v106.css` en alle logo-afbeeldingen.

## Bekende beperkingen

- Een iOS-web/PWA kan in de achtergrond volledig worden gepauzeerd; hervatten triggert direct een nieuwe poging.
- De SQL en end-to-end-RLS-tests zijn niet uitgevoerd omdat geen afzonderlijk testproject of lokale Supabase aan deze werkomgeving was gekoppeld.
- Automatische cleanup is pas actief nadat het optionele cronbestand handmatig in het testproject is uitgevoerd.
- OpenStreetMap-standaardtiles zijn geschikt voor development; kies vóór grootschalige productie een provider met passend gebruiksbeleid.

