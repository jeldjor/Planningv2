# Testcontrole Planning-GJsystems v11.0

## Uitgevoerd in de bouwomgeving

- [x] Alle JavaScript-entrypoints en inline scripts syntactisch gecontroleerd.
- [x] Volledige regressiesuite uitgevoerd: configuratie, authenticatie, rollen, RLS-contracten, locatiebeheer, routecorrecties, mobiele en laptop-UI.
- [x] Gedeelde dagengine gecontroleerd op huis-klanten-huis, afstand, rijtijd, pauze, afwezigheid en terugrit.
- [x] Routeoptimalisatie gecontroleerd op behoud van alle bezoeken en een efficiëntere volgorde.
- [x] Atomaire routeopslag, dagverplaatsing en historieherplanning gecontroleerd op SQL-contract.
- [x] Private Storage-regels, signed foto-URL's en blokkeren van dubbele fotopaden gecontroleerd.
- [x] Productiebouw gemaakt en gecontroleerd op aanwezigheid van v11-bestanden.
- [x] Veilige service-workercontrole uitgevoerd; runtimeconfiguratie en Supabase-data worden niet gecachet.

## Uitgevoerde PDF-scenario's

- [x] Bijenkorf met 4 foto's.
- [x] Scapino met 8 foto's.
- [x] Intersport met 2 foto's.
- [x] Van Tilburg Sport met 6 foto's.
- [x] Onbekende keten met Stichd-template.
- [x] Bezoek zonder foto's.
- [x] Bezoek met 1 foto.
- [x] Niet uitgevoerd bezoek met reden.
- [x] Lange samenvatting op 2 pagina's.
- [x] Ontbrekende contactpersoon.
- [x] Ontbrekend logo met tekstterugval.
- [x] Ontbrekende/onbereikbare foto veilig overgeslagen.
- [x] iPhone-openmodus gegenereerd.
- [x] Meer dan 8 foto's op 2 pagina's.

Alle gegenereerde bestanden zijn A4 staand, bevatten één of twee niet-lege pagina's en hebben correcte paginanummering. De gerenderde contactcontrole toont geen afgesneden tekst, overlap, kapotte afbeeldingen of vervormde foto's. De voorbeelden en het JSON-manifest staan in `output/pdf`.

## Verplicht uitvoeren op de echte ontwikkelomgeving

Deze punten konden zonder projectgegevens, TomTom-secret en fysieke apparaten niet werkelijk worden afgevinkt:

- [ ] Databaseback-up maken en `SUPABASE_V11_0_CORE.sql` op een kopie van de huidige database uitvoeren.
- [ ] `tomtom-proxy` en `admin-users` deployen en serverlogs op fouten controleren.
- [ ] Planning genereren met echte klanten; iedere succesvolle route moet direct groen zijn.
- [ ] Complete dag naar een lege datum slepen, verversen en op een tweede apparaat controleren dat de dag blijft staan.
- [ ] Op iPhone volgorde, bezoektijd en vertrektijd wijzigen; alle tijden, kilometers en rijtijd moeten direct gelijk zijn aan laptop.
- [ ] Route optimaliseren met verschillende klantvolgorden en controleren dat thuis- en terugrit meetellen.
- [ ] Een afwezigheid van 10:00–11:00 op mobiel en laptop controleren; het eerste bezoek erna mag niet vóór 11:00 starten.
- [ ] Uitgevoerd en niet-uitgevoerd opslaan, opnieuw openen en controleren dat de status niet terugvalt naar Gepland.
- [ ] Dezelfde foto éénmaal uploaden en controleren dat zij één keer in historie en PDF staat.
- [ ] Niet-uitgevoerd bezoek vanuit Historie herplannen en bevestigen dat de oorspronkelijke historie behouden blijft.
- [ ] Gelijktijdige wijziging op laptop en iPhone testen, inclusief herladen na Realtime-synchronisatie.
- [ ] PDF op echte laptop openen/downloaden en op echte iPhone openen, delen en bewaren.
- [ ] RLS testen met twee gewone gebruikers en één beheerder; gebruikers mogen elkaars planning en foto's niet zien.
- [ ] Trage verbinding, tijdelijk onbereikbare foto en tijdelijke TomTom-fout testen op duidelijke foutmelding en herstel.
- [ ] iPhone-PWA sluiten/heropenen en controleren dat nieuwe app-shellbestanden laden zonder oude v10-cache.

Vervang de huidige werkversie pas nadat alle bovenstaande live punten zijn afgevinkt en een herstelkopie beschikbaar is.
