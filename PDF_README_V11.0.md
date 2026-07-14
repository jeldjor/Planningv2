# Dynamische winkelbezoek-PDF v11.0

## Ketenherkenning

De generator leest primair het centrale veld `customers.keten`. `customers.naam` of de vrije winkelnaam wordt alleen als winkelnaam afgedrukt en bepaalt nooit het profiel. Normalisatie verwijdert hoofdletterverschillen, accenten, leestekens en extra spaties.

De profielen staan in `chainProfiles` in `visit-pdf.js`:

- `bijenkorf`
- `scapino`
- `inno`
- `intersport`
- `van_tilburg_sport`
- `stichd` als algemene terugval

Voeg een keten toe door één object toe te voegen met `displayName`, `aliases`, `primary`, `secondary`, `soft` en eventueel `logo`. Wanneer geen goedgekeurd logo beschikbaar is, gebruikt de PDF automatisch een nette tekstheader.

## Gebruikte gegevens

De bestaande PDF-knop haalt bij iedere klik de actuele gegevens op:

- `visit_history`: klant- en planningkoppeling, bezoekdatum, start- en eindtijd, activiteit, status, reden, samenvatting, opmerkingen, uitgevoerde werkzaamheden, aandachtspunten en vervolgactie;
- `planning`: klant, datum, tijden, status en notities als terugval;
- `customers`: keten, winkelnaam, vestiging, adres, postcode, plaats en contactpersoon;
- `profiles`: naam of e-mailadres van de bezoeker;
- `visit_photos`: unieke Storage-paden van de bezoekfoto's.

Lege optionele velden en secties worden niet getoond. De generator verzint geen inhoud.

## Foto's en Storage

De bucket `visit-photos` is privé. De app probeert eerst een aangemelde Storage-download. Wanneer dat niet lukt, vraagt zij een signed URL met een geldigheid van vijf minuten aan. Ontbrekende of onbereikbare bestanden worden overgeslagen en veroorzaken geen kapotte afbeelding of technische fouttekst in de PDF.

Het raster past zich aan nul tot acht foto's aan. Foto's behouden hun verhouding en worden binnen gelijke kaders geplaatst. Vanaf de negende foto volgt een vervolgpagina.

## Weergave

- A4 staand;
- één pagina wanneer de inhoud leesbaar past;
- automatische vervolgpagina's voor lange tekst of extra foto's;
- ketenspecifieke header en accentkleur;
- tweekoloms gegevensblok zonder lege labels;
- dynamisch fotoraster zonder vervorming;
- vaste rustige footer met Planning-GJsystems, Stichd, generatiedatum en paginanummer.

Op laptop wordt het rapport gedownload. Op iPhone wordt vooraf een voorbeeldvenster geopend en daarna met de PDF gevuld, zodat de normale iOS-functies voor delen en bewaren beschikbaar blijven.

## Bekende beperking

Er zijn geen externe ketenlogo's zonder expliciete merkrechtelijke toestemming toegevoegd. De zes profielen gebruiken daarom ketenspecifieke kleuren en een tekstlogo. Een later goedgekeurd logo kan via het profiel worden toegevoegd zonder de generator te herschrijven.
