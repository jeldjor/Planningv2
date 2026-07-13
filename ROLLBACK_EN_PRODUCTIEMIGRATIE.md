# Rollback- en productiemigratieplan

## Waarom v10.7-productie intact blijft

- Deze map gebruikt een eigen repositorynaam, deployment-URL en expliciete developmentconfiguratie.
- Er zijn geen productiecredentials opgenomen.
- Geen SQL, CLI-link, migration push of query is vanuit deze oplevering op productie uitgevoerd.
- De app weigert een configuratie die niet als development/test is gemarkeerd.
- De bestaande v10.7-repository, deployment en Supabase-database hoeven voor testen nergens te worden gewijzigd.

## Developmentomgeving buiten gebruik zetten

1. Zet Live Locaties centraal Uit.
2. Stop de developmentdeployment of verwijder de development-URL.
3. Trek alleen de GitHub-secrets van de testrepository in.
4. Verwijder eventueel de twee Edge Functions uit het testproject.
5. Archiveer of verwijder daarna uitsluitend het afzonderlijke Supabase-testproject.
6. Laat productie en de v10.7-repository ongemoeid.

## Later gecontroleerd naar productie

Gebruik `SUPABASE_V10_8_LIVE_LOCATIONS_DEV.sql` **niet zomaar rechtstreeks op productie**. Maak na acceptatie een nieuwe, productiegerichte migratie op basis van een actuele schema-export van productie.

Voorwaarden vóór productie:

1. Voltooi alle open echte tests met beheerder, gebruiker A en gebruiker B.
2. Maak een actuele productiebackup en controleer herstelbaarheid.
3. Vergelijk productie-schema, constraints, functies, grants, policies, publicatie en Storage met de testbaseline.
4. Zet uitsluitend de vier locatietabellen, locatiefuncties, policies en benodigde publicaties om naar een productie-increment; voer de DEV-baseline niet op productie uit.
5. Laat de productie-increment vooraf reviewen op `auth.uid()`, `security definer`, `search_path`, grants en RLS.
6. Neem een onderhoudsvenster, registreer de huidige deployversie en test een rollback in staging.
7. Migreer eerst database, daarna Edge Functions, daarna frontendconfig/deployment.
8. Bevestig dat Live Locaties na migratie nog steeds Uit staat.
9. Voer rooktests uit en zet de functie pas daarna bewust aan.

## Gegevensbehoud en rollback

- De productie-increment mag bestaande v10.7-tabellen niet droppen, hernoemen of leegmaken.
- Bestaande gebruikers, klantdata, planning, historie, Contact en Storage blijven staan.
- Frontendrollback: herdeploy de exact geregistreerde v10.7-build en zet Live Locaties Uit.
- Databaserollback: behoud locatietabellen eerst voor onderzoek; verwijder ze alleen via een afzonderlijk goedgekeurde down-migratie. Geen bestaande v10.7-tabellen wijzigen.
- Edge Functions kunnen onafhankelijk worden teruggezet of uitgeschakeld.

