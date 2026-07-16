# Dynamische winkelbezoek-PDF v11.0

## Ketenherkenning

De generator leest primair het centrale veld `customers.keten`. `customers.naam` of de vrije winkelnaam wordt alleen als winkelnaam afgedrukt en bepaalt nooit het profiel. Normalisatie verwijdert hoofdletterverschillen, accenten, leestekens en extra spaties.

De profielen staan in `chainProfiles` in `visit-pdf.js`:

- `bijenkorf`
- `scapino`
- `inno`
- `intersport`
- `van_tilburg_sport`
- `van_haren`
- `bomont`
- `daka`
- `e5`
- `molecule`
- `torfs`
- `veritas`
- `berden`
- `stichd` als algemene terugval

Alle dertien bekende ketens hebben vanaf v11.3.5 een eigen winkelbanner. De vijf oorspronkelijke banners staan in `assets/chain-banners-core.png`; de acht later aangeleverde banners staan in `assets/chain-banners.png`. De banner staat onvervormd over de volledige paginabreedte. Daaronder staan de actuele bezoekgegevens één keer in een compact blok.

Voeg een keten toe door één object toe te voegen met `displayName`, `aliases`, `primary`, `secondary`, `soft` en eventueel `banner`. De goedgekeurde banners staan in `assets/chain-banners.png`; het `banner`-object bevat de uitsnede `x`, `y`, `w` en `h`. Wanneer geen goedgekeurde banner beschikbaar is, gebruikt de PDF automatisch een nette tekstheader.

## Gebruikte gegevens

De bestaande PDF-knop haalt bij iedere klik de actuele gegevens op:

- `visit_history`: klant- en planningkoppeling, bezoekdatum, activiteit, status, reden, samenvatting, opmerkingen, uitgevoerde werkzaamheden, aandachtspunten en vervolgactie;
- `planning`: klant, datum, status en notities als terugval;
- `customers`: keten, winkelnaam, vestiging, adres, postcode, plaats en contactpersoon;
- `profiles`: naam of e-mailadres van de bezoeker;
- `visit_photos`: unieke Storage-paden van de bezoekfoto's.

Lege optionele velden en secties worden niet getoond. De generator verzint geen inhoud. In het bezoekverslag wordt alleen de bezoekdatum getoond; start- en eindtijd worden bewust nooit afgedrukt.

## Foto's en Storage

De bucket `visit-photos` is privé. De app probeert eerst een aangemelde Storage-download. Wanneer dat niet lukt, vraagt zij een signed URL met een geldigheid van vijf minuten aan. Ontbrekende of onbereikbare bestanden worden overgeslagen en veroorzaken geen kapotte afbeelding of technische fouttekst in de PDF.

Het raster past zich aan nul tot acht foto's aan. Foto's worden eerst met hun EXIF-oriëntatie opnieuw gedecodeerd, behouden daarna hun verhouding en worden binnen gelijke kaders geplaatst. Vanaf de negende foto volgt een vervolgpagina.

## Weergave

- A4 staand;
- één pagina wanneer de inhoud leesbaar past;
- automatische vervolgpagina's voor lange tekst of extra foto's;
- ketenspecifieke header en accentkleur;
- compact gegevensblok in drie kolommen zonder lege labels of dubbele informatie;
- de bezoekdatum staat precies één keer in het rapport; start- en eindtijd worden nooit afgedrukt;
- samenvatting vóór de foto's, met voldoende witruimte;
- dynamisch fotoraster zonder vervorming;
- vaste rustige footer met uitsluitend GJsystems en het paginanummer.

Op laptop wordt het rapport gedownload. Op iPhone wordt vooraf een voorbeeldvenster geopend en daarna met de PDF gevuld, zodat de normale iOS-functies voor delen en bewaren beschikbaar blijven.

## Bekende beperking

Alle dertien bekende ketens gebruiken een aangeleverde banner. Onbekende of later toegevoegde ketens gebruiken het configureerbare Stichd-profiel met tekstheader totdat een goedgekeurde banner wordt toegevoegd.
