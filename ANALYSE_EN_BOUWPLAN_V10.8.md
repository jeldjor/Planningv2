# Analyse en bouwplan v10.8

## Fase 1 – uitgevoerde analyse

De volledige v10.7-map is vooraf geïnventariseerd: HTML, JavaScript, CSS, afbeeldingen, beide SQL-incrementen en installatie-/controlebestanden. Laptop en iPhone zijn afzonderlijk nagekeken op login, werkruimtefilters, beheer, planning, synchronisatie, instellingen, profiel, Contact, onderhoud en TomTom.

Belangrijkste bevindingen:

- v10.7 gebruikte één `profiles.role` en `is_app_admin()` als centrale rolbron; deze bron is behouden.
- De Supabase Auth-sessie bepaalt de echte gebruiker. De werkruimteproxy kan voor een beheerder een andere `user_id` filteren. Locaties mogen die proxy daarom niet gebruiken.
- De zichtbare functie Voordoen als gebruiker was in v10.7 effectief uitgeschakeld doordat `auth.js` de selectie bij login verwijderde. v10.8 valideert de gekozen gebruiker, maar pauzeert alle locatieprocessen tijdens voordoen.
- Scripts worden vanuit meerdere schermen opnieuw aangeraakt. Een locatiemodule per scherm zou dubbele timers/listeners veroorzaken; daarom is één bevroren globale manager gebouwd.
- v10.7 bevatte een oude laptop-synchronisatiemodule die al bewust onmiddellijk retourneert. Die blokkering is behouden om de bekende vervanging van klantnamen, routes en tijden niet opnieuw te activeren.
- De bronbestanden bevatten hardcoded productieconfiguratie. Alle clients zijn naar een gevalideerde runtimeconfiguratie omgezet.
- De meegeleverde v10.7-SQL is een increment voor een bestaande database en kan een leeg testproject niet zelfstandig opbouwen. Daarom is een expliciete, test-only v10.7-baseline toegevoegd; er zijn geen gebruikers of productiegegevens opgenomen.
- Auth-gebruikersbeheer en TomTom vereisen serverbevoegdheden. Hiervoor zijn Edge Functions toegevoegd; geen service-role-key gaat naar de browser.

## Status vóór bouw

| Onderdeel | v10.7-status | Gevolg |
|---|---|---|
| Login, profiel, centrale rol | Aanwezig | Behouden en hergebruikt |
| Werkruimte per gebruiker | Aanwezig via clientfilter en RLS-increment | Behouden; baseline toegevoegd voor leeg testproject |
| Voordoen als gebruiker | UI aanwezig, bij login uitgeschakeld | Hersteld met harde locatiepauze |
| Laptop/iPhone planning en modules | Aanwezig | Niet herschreven; regressiecontrole |
| Veilige environmentconfig | Ontbrak | Toegevoegd, productieconfig verwijderd |
| Live Locaties database/backend | Ontbrak | Volledig toegevoegd |
| Toestemming/timer/voorgrond | Ontbrak | Centrale manager toegevoegd |
| Beheerkaarten/historie | Ontbrak | Gedeelde responsive module toegevoegd |
| Realtime met fallback | Deels aanwezig voor bestaande modules | Voor locaties toegevoegd |
| Leeg testproject-baseline | Ontbrak | Afzonderlijk DEV-baselinebestand toegevoegd |

## Fase 2 – bouwplan en raakvlakken

1. Kopieer v10.7 naar een nieuwe map zonder productieconfiguratie of oude productiedocumenten.
2. Voeg een fail-closed developmentconfig toe en controleer alle Supabase-clientinitialisaties op laptop en iPhone.
3. Bouw een herhaalbare v10.7-testbaseline die dezelfde tabellen, centrale rol, RLS, Storage en RPC-contracten levert.
4. Bouw een afzonderlijke v10.8-migratie met vier locatietabellen, constraints, indexes, RLS, minimale grants en `auth.uid()`-RPC's.
5. Bouw één locatiemanager voor centrale configuratie, toestemming, GPS, upsert+historie, timer, voorgrond, uitloggen, voordoen, Realtime en fallback.
6. Integreer gebruikersstatus in Instellingen en beheerinstellingen, gebruikerslijst, actuele kaart en 1/4/8/24-uurskaart in Beheer.
7. Gebruik dezelfde statusberekening en dezelfde data op laptop en iPhone.
8. Voeg server-only Edge Functions toe voor bestaande beheerders- en TomTomfunctionaliteit in een leeg project.
9. Test configisolatie, syntaxis, singleton/timerregels, toestemming, rolweergave, SQL-beveiligingscontracten en byte-identieke v10.7-ondersteuningsbestanden.
10. Documenteer echte tests die pas na inrichting van het nieuwe Supabase-project en op een iPhone kunnen plaatsvinden.

Raakvlakken met bestaande functies zijn beperkt tot `auth.js`, beide HTML-entrypoints en de nieuwe v10.8-bestanden. `v105.*`, `v106.*` en alle logo-assets blijven byte-identiek.

