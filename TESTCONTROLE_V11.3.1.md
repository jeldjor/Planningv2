# Testcontrole v11.3.1

Geautomatiseerde eindstatus: **87 van 87 tests geslaagd**, alle 14 PDF-scenario’s opnieuw gegenereerd en de productiebouw geslaagd.

- [x] Aankomst vóór opening geeft de juiste wachttijd per bezoek.
- [x] Geen wachttijd toont geen lege wachttijdregel.
- [x] Wachttijd wordt opgenomen in de centrale dagroute-JSON.
- [x] iPhone neemt opgeslagen wachttijd opnieuw over bij laden.
- [x] Realtime daginstellingen werken de wachttijd bij.
- [x] Routevolgorde, openingstijden, bezoekduur en terugrit blijven via de centrale dagengine lopen.
- [x] Laptop en iPhone laden dezelfde v11.3.1-route-engine.
- [x] Volledige geautomatiseerde regressietest uitgevoerd.
- [x] Productiebouw uitgevoerd.
- [x] Bestaande historie wordt via één beveiligde RPC bijgewerkt zonder nieuwe historierij.
- [x] Uitvoeringsdatum is op laptop en iPhone beschikbaar bij een reeds afgerond bezoek.
- [x] iPhone toont één fotokiezer en een afzonderlijke verwijderstand.
- [x] Opgeslagen foto wordt via Storage API verwijderd vóór de databasekoppeling.
- [x] EXIF-oriëntatie wordt vóór de PDF rechtgezet.
- [x] PDF-detailvelden bevatten geen start- of eindtijd.
- [x] Acht nieuwe ketenprofielen en het bannerbestand worden in de productiebouw opgenomen.
- [x] Afwezigheid 08:00–10:00 blijft op dezelfde dag 08:00–10:00.
- [x] iPhone-afwezigheid heeft wijzigen en verwijderen met bevestiging.
- [x] Toevoegen, wijzigen en verwijderen start een nieuwe routeberekening voor alle betrokken dagen.
- [x] Historie leest klantnaam en plaats via de centrale klantrelatie.
- [x] Planninggenerator schrijft nieuwe bezoeken uitsluitend als Gepland of Vast.
- [x] Database herstelt en blokkeert `Uitgevoerd` zonder bijbehorende historierij.

Nog éénmalig live controleren na installatie:

- [ ] `SUPABASE_V11_3_1_RELEASE.sql` uitvoeren in het gekoppelde Supabase-project.
- [ ] Eén bestaand bezoek op iPhone openen, datum wijzigen, foto verwijderen en opnieuw openen.
- [ ] Eén PDF met een iPhone-foto en één PDF per gebruikte nieuwe keten openen.
