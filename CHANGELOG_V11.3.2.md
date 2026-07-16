# Changelog v11.3.2

## Historie en foto-export

- In het geopende historiebezoek staat op laptop en iPhone één knop `Alle foto's opslaan (.zip)`.
- De ZIP heet `<klantnaam>_<bezoekdatum>.zip`.
- `Bezoekverslag.txt` bevat klant, onderwerp/activiteit, bezoekdatum en de opgeslagen samenvatting.
- Iedere bezoekfoto staat daarnaast als afzonderlijk origineel fotobestand in de ZIP.
- Beveiligde foto’s worden rechtstreeks uit de private Supabase Storage-bucket gedownload; verlopen signed URL’s worden niet hergebruikt.
- iPhone gebruikt waar mogelijk het normale deel-/opslaanvenster en valt anders terug op een browserdownload.

## Betrouwbaar legen

- De app verwijdert gekoppelde bezoekfoto’s eerst via de officiële Storage API.
- Daarna worden `visit_photos`, `visit_history`, `planning`, vaste afspraken en klanten in een veilige afhankelijkheidsvolgorde verwijderd.
- Planning legen behoudt historie en maakt alleen de oude planningkoppeling los.
- De cumulatieve migratie herstelt uitvoerstatussen waarvoor geen historie bestaat en blokkeert herhaling.

## Afwezigheid synchroniseren

- Toevoegen en verwijderen op de laptop wordt nu eerst in Supabase bevestigd en pas daarna lokaal getoond.
- De laptop haalt bij iedere volledige synchronisatie de actuele afwezigheden opnieuw op.
- `app_absences` gebruikt volledige Realtime-deletegegevens, zodat een op laptop verwijderde afwezigheid direct op de geopende iPhone verdwijnt.
- Na toevoegen of verwijderen wordt de volledige betrokken dagroute opnieuw berekend.

## Gewijzigde en nieuwe bestanden

- `photo-zip.js`
- `laptop.html`
- `mobile.html`
- `v11.js`
- `v106.js`
- `planning-core.js`
- `service-worker.js`
- `package.json`
- `package-lock.json`
- `SUPABASE_V11_3_2_RELEASE.sql`
- `README.md`
- `INSTALLATIE_V11.3.2.md`
- `TESTCONTROLE_V11.3.2.md`
- `tests/release-v11_3_2.test.mjs`
