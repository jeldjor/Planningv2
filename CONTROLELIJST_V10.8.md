# Controlelijst Planning-GJsystems v10.8

Betekenis:

- ✅ **Geslaagd**: automatisch uitgevoerd in deze werkomgeving.
- 🟨 **Statisch gecontroleerd**: code/SQL aantoonbaar gecontroleerd, maar nog niet tegen een echt Supabase-testproject of echte iPhone uitgevoerd.
- ❌ **Nog niet uitgevoerd**: vereist het nieuwe testproject, echte accounts, netwerk/deployment of een iPhone/PWA.

De automatische testopdracht was `npm test`: **19 tests geslaagd, 0 mislukt**. Ook zijn de runtimeconfiguratiegenerator en volledige deploybuild met fictieve testwaarden succesvol uitgevoerd; de gegenereerde waarden zijn daarna verwijderd. Er is geen SQL uitgevoerd.

## Scheiding en configuratie

| Acceptatiepunt | Status | Werkelijke controle |
|---|---|---|
| Nieuwe repository wijst niet naar productie | ✅ Geslaagd | Deploybare frontend gecontroleerd op hardcoded Supabase-URL/key; config valideert development/test en project-ref. |
| Nieuwe app gebruikt het nieuwe Supabase-testproject | ❌ Nog niet uitgevoerd | Er is bewust nog geen testprojectconfiguratie ingevuld. |
| Productiedatabase is niet gewijzigd | ✅ Geslaagd | Geen Supabase-project gekoppeld en geen SQL/CLI-actie uitgevoerd. |
| Geen geheimen/service-role-key in frontend | ✅ Geslaagd | Configtest en broncontrole; service-role alleen in Edge Function environment. |
| Ontbrekende/foute config geeft duidelijke ontwikkelfout | ✅ Geslaagd | Automatische configtests. |

## Centrale werking en toestemming

| Acceptatiepunt | Status | Werkelijke controle |
|---|---|---|
| Live Locaties staat standaard uit | 🟨 Statisch gecontroleerd | SQL-default en singleton-insert zijn `false`; nog niet op test-DB uitgevoerd. |
| Zolang uit: geen melding, GPS, opslag, timer of locatielisteners | ✅ Geslaagd | Geautomatiseerde DOM/managertest voor melding, GPS, timer en listeners; RPC-blokkade statisch gecontroleerd. |
| Beheerder kan centraal aanzetten | 🟨 Statisch gecontroleerd | UI en admin-RPC aanwezig; echte DB-test ontbreekt. |
| Gewone gebruiker kan centraal niet wijzigen of beheer-URL openen | 🟨 Statisch gecontroleerd | UI-rolpoort, admin-RPC en RLS/GRANT-contract gecontroleerd; gemanipuleerde echte sessie nog testen. |
| Eenmalige melding gebruikt exact de afgesproken tekst | ✅ Geslaagd | Geautomatiseerde DOM-test. |
| Nu niet opent geen officiële locatievraag | ✅ Geslaagd | Geautomatiseerde DOM/geolocation-test. |
| Toestaan opent de officiële locatievraag | ✅ Geslaagd | Geautomatiseerde DOM/geolocation-test. |
| Toestemming resulteert direct in locatie | 🟨 Statisch gecontroleerd | Flow en directe aanroep getest met mocks; echte iPhone + DB ontbreekt. |
| Geweigerd/geblokkeerd/services uit/timeout/intrekking crasht niet | 🟨 Statisch gecontroleerd | Alle foutpaden en statusopslag aanwezig; echte browservarianten ontbreken. |
| Instellingen toont centrale, eigen en officiële status | 🟨 Statisch gecontroleerd | Gedeelde laptop/iPhone-DOM gecontroleerd. |

## Locatie, timer en PWA

| Acceptatiepunt | Status | Werkelijke controle |
|---|---|---|
| Laatste locatie via upsert en historiepunt atomisch toegevoegd | 🟨 Statisch gecontroleerd | Eén security-definer-RPC bevat beide transactiestappen; DB-uitvoering ontbreekt. |
| Alleen betrouwbare snelheid/richting opgeslagen | 🟨 Statisch gecontroleerd | Frontend- en SQL-validatie aanwezig. |
| Intervalkeuzes 5/10/15/30/60 en standaard 10 | ✅ Geslaagd | Status/managertests plus SQL-constraintcontrole. |
| Intervalwijziging veroorzaakt geen dubbele timer | ✅ Geslaagd | Singletontest: precies één interval na herinitialisatie. |
| Openen/login veroorzaakt directe update | 🟨 Statisch gecontroleerd | Auth-ready/init-pad aanwezig; echte sessie/GPS ontbreekt. |
| Terugkeer naar voorgrond veroorzaakt directe update | 🟨 Statisch gecontroleerd | Enkele visibility/focus/pageshow-listeners aanwezig; echte iPhone ontbreekt. |
| Schermwissels veroorzaken geen dubbele updates/listeners | ✅ Geslaagd | Herinitialisatietest op singleton, timer en listeners. |
| Uitloggen stopt processen/subscriptions | 🟨 Statisch gecontroleerd | `gj-auth-signed-out` en `destroy()` gecontroleerd; echte sessie ontbreekt. |
| Centraal uitschakelen stopt direct | 🟨 Statisch gecontroleerd | Realtime-reconcile en server-RPC-blokkade aanwezig; echte Realtime-test ontbreekt. |
| Voordoen als gebruiker schrijft geen verkeerde locatie | 🟨 Statisch gecontroleerd | Manager pauzeert; RPC heeft geen user_id en gebruikt auth.uid(); gemanipuleerde echte test ontbreekt. |
| Geen internet veroorzaakt geen crash en probeert later opnieuw | 🟨 Statisch gecontroleerd | Offline-afbreking en enkele `online`-listener aanwezig; echte netwerkonderbreking ontbreekt. |
| iOS/PWA-beperking eerlijk weergegeven | ✅ Geslaagd | README en beheerweergave tonen echte tijd/ouderdom; geen achtergrondbelofte. |

## Beveiliging en accounts

| Acceptatiepunt | Status | Werkelijke controle |
|---|---|---|
| Client kiest geen vrij locatie-user_id | ✅ Geslaagd | Automatische bron- en RPC-signatuurtest. |
| RLS forceert eigen instellingen/actuele locatie | 🟨 Statisch gecontroleerd | Policies, FORCE RLS, ingetrokken writes en auth.uid-RPC gecontroleerd. |
| Gebruiker A kan B niet lezen/overschrijven | ❌ Nog niet uitgevoerd | Vereist testproject en twee echte JWT's. |
| Gebruiker B kan A niet lezen/overschrijven | ❌ Nog niet uitgevoerd | Vereist testproject en twee echte JWT's. |
| Beheerder ziet A en B | ❌ Nog niet uitgevoerd | Vereist testproject en drie accounts. |
| Centrale bestaande rolbron wordt hergebruikt | ✅ Geslaagd | `profiles.role` + `is_app_admin()` in auth, SQL en Edge Functions. |
| Beheerfuncties controleren rol server-side | 🟨 Statisch gecontroleerd | RPC's en Edge Function-controles aanwezig; echte tokens ontbreken. |
| Auth-testaccounts worden niet automatisch gemaakt | ✅ Geslaagd | SQL bevat geen productie/testaccountcreatie; README geeft handmatige stappen. |

## Beheer, kaarten en historie

| Acceptatiepunt | Status | Werkelijke controle |
|---|---|---|
| Status Actueel/Verouderd/Offline klopt op 1,5× en 3× interval | ✅ Geslaagd | Automatische grenswaardetest. |
| Geen locatie, toestemming en Centraal uit-statussen | ✅ Geslaagd | Gedeelde status-/labeltest en DOM-controle. |
| Naam en profielfoto bij juiste gebruiker | 🟨 Statisch gecontroleerd | Admin-RPC koppelt alles op profile-id; echte accountdata ontbreekt. |
| Actuele kaart toont juiste gebruiker en oude locatie niet als live | 🟨 Statisch gecontroleerd | Markers gebruiken gedeelde statusfunctie; echte kaartdata ontbreekt. |
| Google Maps-knop | 🟨 Statisch gecontroleerd | URL wordt uit ontvangen lat/lon gemaakt; browserklik nog testen. |
| Historiekaart bevraagt alleen gekozen gebruiker | 🟨 Statisch gecontroleerd | Admin-RPC vereist gekozen UUID en adminrol; echte RLS-query ontbreekt. |
| Filters 1, 4, 8 en 24 uur | 🟨 Statisch gecontroleerd | UI-keuzes en RPC-whitelist aanwezig; echte dataquery ontbreekt. |
| Chronologische punten, oudste/nieuwste, lijn en nummering | 🟨 Statisch gecontroleerd | SQL sorteert oplopend; DOM/kaart markeert oudste en nieuwste. |
| Punten ouder dan 24 uur worden verwijderd na cleanupactivatie | ❌ Nog niet uitgevoerd | Cleanup en apart cronstatement zijn aanwezig, maar bewust niet geactiveerd. |
| Realtime-uitval gebruikt fallback | 🟨 Statisch gecontroleerd | 60-secondenfallback aanwezig; echte kanaaluitval ontbreekt. |
| Laptop en iPhone gebruiken dezelfde manager/config/statusfunctie | ✅ Geslaagd | Beide entrypoints laden dezelfde `v108.js`; automatische referentietest. |

## Regressie v10.7

| Onderdeel | Status | Werkelijke controle |
|---|---|---|
| Login/uitloggen/rollen/Beheer | 🟨 Statisch gecontroleerd | Inline syntax, authcontract, centrale rol en Edge Function compilecontrole. |
| Voordoen als gebruiker | 🟨 Statisch gecontroleerd | Herstel/validatie en locatiepauze gecontroleerd; echte sessie ontbreekt. |
| Vandaag/Kalender/Overzicht | 🟨 Statisch gecontroleerd | Bestaande modules behouden en scripts syntactisch geldig; functionele browsertest ontbreekt. |
| Database/planning/vaste afspraken/afwezigheid | 🟨 Statisch gecontroleerd | Bestaande modules behouden; baseline-tabellen/RLS toegevoegd; echte dataflow ontbreekt. |
| Rapportages/historie/foto's | 🟨 Statisch gecontroleerd | Bestaande code en Storage-baseline aanwezig; echte bestanden/data ontbreken. |
| Instellingen/profiel/wachtwoord | 🟨 Statisch gecontroleerd | Bestaande code behouden; locatiestatus geïntegreerd; echte Auth/Storage ontbreekt. |
| Contact/bijlagen/statussen | 🟨 Statisch gecontroleerd | Tabellen, policies en bestaande UI aanwezig; end-to-end ontbreekt. |
| Laptopinterface en iPhone-interface | 🟨 Statisch gecontroleerd | Beide HTML-bestanden compileerbaar en gedeelde responsive CSS aanwezig; echte visuele devicecontrole ontbreekt. |
| Supabase-synchronisatie en werkruimtes | 🟨 Statisch gecontroleerd | Proxy/RLS en Realtimecode gecontroleerd; echte meeraccounttest ontbreekt. |
| `v105.*`, `v106.*` en logo-assets behouden | ✅ Geslaagd | SHA-256 bytevergelijking met v10.7-basis. |
| Alle inline laptop- en iPhonescripts syntactisch geldig | ✅ Geslaagd | Iedere inline scriptbody met JavaScript-compiler gecontroleerd. |
| Edge Functions syntactisch geldig | ✅ Geslaagd | TypeScript-transpilatie van beide functies. |

## Nog verplicht vóór goedkeuring

De ❌- en 🟨-punten die een echt backend/device vereisen moeten na installatie worden uitgevoerd. Met name de twee-user-RLS-tests, centrale aan/uit-flow, echte iPhone-toestemming, voorgrondhervatting, kaarten met echte testdata, cleanup en volledige v10.7-regressierun mogen pas daarna als volledig geslaagd worden beschouwd.
