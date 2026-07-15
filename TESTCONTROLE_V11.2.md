# Testcontrole Planning-GJsystems v11.2.0

Uitgevoerd op 15 juli 2026.

## Automatische controles

- `npm test`: 72 geslaagd, 0 mislukt.
- `npm run test:pdf`: 14 scenario's gegenereerd, 0 mislukt.
- `npm run build`: deploymentmap succesvol gemaakt.
- Alle inline scripts van laptop en iPhone compileren syntactisch.
- Beide Edge Functions compileren syntactisch als TypeScript.
- Frontend bevat geen service-role-key of TomTom API-sleutel.

## Routecontroles

- Eén gebundelde routeaanroep per dag.
- Geen losse `action: route`-aanroep meer in laptop- of iPhone-code.
- Huis - klanten - huis wordt in één centraal resultaat opgebouwd.
- Gewijzigde volgorde, bezoekduur en vertrektijd gebruiken dezelfde dagengine.
- Afwezigheid, parkeerbuffer, pauze en terugrit tellen mee.
- Een gedeeltelijke batch wordt niet groen opgeslagen.
- Ongeldige coördinaten worden vóór de Edge-aanroep geweigerd.
- Tijdelijke netwerk-, time-out-, HTTP 429- en HTTP 5xx-situaties zijn begrensd en geven een leesbare foutcode.

## Werkelijk Supabase-project

- Migratie `planning_v11_2_release` succesvol toegepast.
- `tomtom-proxy` actief als versie 11.
- Actieve Edge-bron gecontroleerd op gepinde dependency, begrensde paralleliteit en request-id.
- Alle bestaande groene dagen hebben na reparatie ook `includesReturn=true`.
- Eén oude inconsistente dag staat terecht rood totdat die opnieuw live wordt berekend.
- Geen resterende advisor-meldingen voor rechtstreeks uitvoerbare triggerfuncties.
- Geen resterende advisor-meldingen voor ontbrekende foreign-key-indexen of dubbele permissive policy.

## PDF-controles

- Bijenkorf met 4 foto's.
- Scapino met 8 foto's.
- Intersport met 2 foto's.
- Van Tilburg Sport met 6 foto's.
- Onbekende keten met Stichd-template.
- 0 foto's, 1 foto, ontbrekend logo en onbereikbare foto.
- Niet uitgevoerd bezoek met reden.
- Lange samenvatting op twee pagina's.
- Meer dan 8 foto's op twee pagina's.
- Alle 16 gerenderde pagina's visueel gecontroleerd: geen overlap, afsnijding, vervorming of lege pagina.

## Nog door de gebruiker te controleren na GitHub-publicatie

- Eén bestaande rode dag openen en `Route optimaliseren` uitvoeren op laptop.
- Dezelfde dag op iPhone openen en controleren dat kilometers en reistijd gelijk zijn.
- Eén volgordewijziging en één vertrektijdwijziging uitvoeren.
- Een dag naar een lege datum slepen en na herladen controleren dat hij blijft staan.
- Eén PDF openen/delen op de echte iPhone.

