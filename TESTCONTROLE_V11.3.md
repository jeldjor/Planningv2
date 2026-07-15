# Testcontrole Planning-GJsystems v11.3.0

Uitgevoerd op 15 juli 2026.

## Automatische controles

- `npm test`: 80 geslaagd, 0 mislukt.
- `npm run test:pdf`: 14 scenario's gegenereerd, 0 mislukt.
- `npm run build`: deploymentmap succesvol gemaakt.
- Alle inline scripts van laptop en iPhone zijn syntactisch compileerbaar.
- Beide Edge Functions zijn syntactisch gecontroleerd.
- Frontend bevat geen service-role-key of TomTom API-sleutel.

## Route- en synchronisatiecontroles

- De route-invoerhash verandert bij een wijziging die invloed heeft op de route.
- Een ongewijzigde groene dag gebruikt de opgeslagen route en roept TomTom niet opnieuw aan.
- Een gewijzigde volgorde, bezoektijd, vertrektijd, coördinaat, thuisinstelling of afwezigheid maakt de oude dagstatus ongeldig en berekent de complete dag opnieuw.
- Laptop leest trajectstatus uit de opgeslagen planning en de terugrit uit de centrale dagstatus.
- Laptop wist bij een normale synchronisatie geen geldige routegegevens.
- iPhone-login laadt planning zonder automatisch alle externe routes opnieuw te starten.
- De laptop kan geen locatieprompt, browserpermissiecontrole, GPS-aanroep of locatietimer starten; de iPhone-flow blijft actief.
- Een gedeeltelijk TomTom-antwoord kan niet als groene route worden opgeslagen.
- Huis, alle bezoeken en de terugrit naar huis tellen mee in kilometers en rijtijd.
- Vroege aankomst wacht tot opening; een bezoek na sluiting en een gesloten bezoekdag worden geweigerd zonder de bestaande volgorde te overschrijven.

## Database- en historiecontroles

- Klantenfilters voor alle, actieve en inactieve klanten zijn aanwezig.
- Actief wijzigen schrijft direct naar Supabase en hertekent de juiste lijst.
- Coördinatenstatus onderscheidt geldig, automatisch gevonden en ongeldig.
- Import controleert en herstelt coördinaten vóór upload en blokkeert rode regels.
- Laptop en iPhone ronden bezoeken af via `complete_visit`.
- Laptop en iPhone verwerken bezoekfoto's via dezelfde maximale bestandsgrootte en automatische JPEG-compressie.
- De functie is in het gekoppelde Supabase-project werkelijk uitgevoerd binnen een teruggedraaide testtransactie.
- De functie is `SECURITY INVOKER`, niet uitvoerbaar door `anon` en wel door `authenticated`.
- Na de teruggedraaide test waren planning en historie aantoonbaar ongewijzigd.

## PDF-controles

- Bijenkorf met 4 foto's.
- Scapino met 8 foto's.
- Intersport met 2 foto's.
- Van Tilburg Sport met 6 foto's.
- Onbekende keten met Stichd-template.
- Geen foto, één foto, ontbrekend logo en onbereikbare foto.
- Niet uitgevoerd bezoek met reden.
- Lange samenvatting en meer dan 8 foto's over twee pagina's.

## Na GitHub-publicatie één keer controleren

1. Open een bestaande groene dag op laptop en iPhone; de dag en alle live trajecten moeten groen blijven en dezelfde totalen tonen.
2. Wijzig één volgorde; controleer dat de hele dag opnieuw wordt berekend en daarna op beide apparaten gelijk is.
3. Rond één testbezoek met één foto af en open het daarna in Historie.
4. Importeer een klein Excel-bestand met één geldige en één ontbrekende coördinaat en controleer de locatiebolletjes.
5. Wissel in de database tussen Alle, Actief en Inactief en zet één testklant tijdelijk inactief en weer actief.
