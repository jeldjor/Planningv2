# Planning-GJsystems v10.10

## Opgelost

- Planning genereren voert na de definitieve optimalisatie altijd opnieuw een volledige live TomTom-berekening uit.
- Alleen volledig live berekende dagen worden groen; de live waarden worden ook naar `planning.route_live`, afstand en reistijd geschreven.
- Bij laden van bestaande planning worden ontbrekende lokale live routecaches automatisch opnieuw berekend.
- Een complete dag wordt eerst volledig in Supabase verplaatst en geverifieerd voordat de lokale kalender wijzigt.
- Realtime herladen wordt tijdens de dagverplaatsing tijdelijk uitgesteld, zodat de oude datum niet meer na één seconde terugkomt.

## Toegevoegd

- `visit-pdf.js`: configureerbare ketenprofielen en professionele, dynamische A4-generator.
- Templates voor Bijenkorf, Scapino, INNO, Intersport, Van Tilburg Sport en algemene Stichd.
- Databasegestuurde bezoek-, klant-, profiel- en fotolader.
- Geauthenticeerde Storage-download met tijdelijke signed-URL-fallback.
- Dynamische fotolay-outs, automatische vervolgpagina's en vaste footer/paginanummers.
- Bestaande laptop-PDF-knoppen gebruiken de nieuwe generator.
- Afgeronde iPhone-bezoeken krijgen de technisch noodzakelijke PDF-actie.
- Lokale, vastgepinde jsPDF-runtime onder `vendor/` voor betrouwbare laptop- en iPhone-uitvoer.

## Gewijzigde bestanden

- `laptop.html`, `mobile.html`
- `v110.js`, `v110.css`
- `visit-pdf.js`
- `vendor/jspdf.umd.min.js`, `vendor/jspdf-LICENSE.txt`
- `scripts/prepare-dist.mjs`, `scripts/generate-pdf-test-cases.mjs`
- `package.json`, `package-lock.json`
- `README.md`
- `tests/release-v110.test.mjs`, bestaande release-/securitytests
- `PDF_README_V10.10.md`, `PDF_CONTROLELIJST_V10.10.md`
- `output/pdf/` met de werkelijk gerenderde testsituaties

Er is geen nieuwe Supabase-migratie nodig.
