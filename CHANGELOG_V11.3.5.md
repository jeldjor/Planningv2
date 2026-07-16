# Changelog v11.3.5

## Definitieve winkelbezoek-PDF

- Het gekozen ontwerp 1 is de standaard voor alle ketenprofielen.
- De ketenbanner loopt over de volledige A4-paginabreedte en behoudt de oorspronkelijke verhouding.
- De oude rechterkolom in de banner is verwijderd, zodat de winkelafbeelding niet meer wordt ingedrukt.
- Bezoekgegevens staan één keer in een rustig blok met drie kolommen.
- Alleen de bezoekdatum wordt getoond; starttijd, eindtijd en generatiedatum worden niet afgedrukt.
- Linksonder in de footer staat uitsluitend `GJsystems`.
- Status staat uitsluitend in de statusbadge.
- Samenvatting en overige unieke tekstsecties staan vóór de foto's.
- Gelijke teksten worden maar één keer opgenomen.
- Vier foto's staan op één rustige rij; andere aantallen houden hun dynamische raster.
- Lange tekst en meer dan acht foto's gebruiken automatisch vervolgpagina's.
- De algemene Stichd-template gebruikt dezelfde opbouw.

## Cache en versie

- Applicatieversie verhoogd naar `11.3.5`.
- Browserassetversie verhoogd naar `113500`.
- Service-workercache verhoogd naar `planning-gjsystems-shell-v11.3.5-r1`.

## Gewijzigde bestanden

- `visit-pdf.js`
- `laptop.html`
- `mobile.html`
- `planning-core.js`
- `service-worker.js`
- `package.json`
- `package-lock.json`
- `v113.js`
- `photo-zip.js`
- `README.md`
- `PDF_README_V11.0.md`
- relevante regressietests onder `tests/`
- `CHANGELOG_V11.3.5.md`
- `INSTALLATIE_V11.3.5.md`
- `TESTCONTROLE_V11.3.5.md`

Er is geen database- of Supabase-wijziging nodig voor deze release.
