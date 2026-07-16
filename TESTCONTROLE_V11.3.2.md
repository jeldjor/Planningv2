# Testcontrole v11.3.2

## Geautomatiseerd

- [x] Volledige `npm test`-suite geslaagd: 92 van 92 tests.
- [x] Alle 14 PDF-scenario’s opnieuw gegenereerd en gecontroleerd.
- [x] Productiebuild geslaagd.
- [x] ZIP-integriteit met `unzip -t` gecontroleerd; geen fouten gevonden.
- [x] ZIP-generator maakt een geldig ZIP-bestand zonder externe bibliotheek.
- [x] `Bezoekverslag.txt` bevat klant, onderwerp, datum en samenvatting.
- [x] Foto’s blijven afzonderlijke bestanden in de ZIP.
- [x] Laptop en iPhone laden dezelfde `photo-zip.js`.
- [x] Leegmaken verwijdert eerst Storage-bestanden en daarna databasekoppelingen.
- [x] Toekomstige uitvoerstatus zonder historie wordt gecorrigeerd en geblokkeerd.
- [x] Laptop verwijdert afwezigheid database-eerst en Realtime DELETE bevat de werkruimte-id voor de iPhone.

## Live acceptatie na installatie

- [ ] Historie-ZIP openen/downloaden op laptop.
- [ ] Historie-ZIP delen of opslaan op iPhone.
- [ ] ZIP bevat de juiste klantnaam, bezoekdatum, samenvatting en alle foto’s.
- [ ] `Alles resetten` op de bedoelde testwerkruimte laat klanten, planning en historie werkelijk leeg.
- [ ] Nieuwe planning bevat geen toekomstige bezoeken met status `Uitgevoerd`.
- [ ] Afwezigheid op laptop verwijderen verdwijnt direct op een geopende iPhone.
