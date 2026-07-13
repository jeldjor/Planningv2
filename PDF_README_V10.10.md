# Dynamische winkelbezoek-PDF - v10.10

## Ketenherkenning

De generator gebruikt primair `customers.keten`. De winkelnaam wordt uitsluitend als winkelnaam getoond en bepaalt de template niet. De ketenwaarde wordt genormaliseerd naar kleine letters, zonder accenten en leestekens. Daardoor gebruiken onder andere Intersport Eindhoven, Tilburg en Breda allemaal het profiel `intersport`, zolang het centrale ketenveld `Intersport` bevat.

Een lege of onbekende keten gebruikt automatisch de algemene professionele Stichd-template.

## Beschikbare profielen

- de Bijenkorf
- Scapino
- INNO
- INTERSPORT
- Van Tilburg Sport
- Stichd (algemene terugvaltemplate)

De profielen staan centraal in `chainProfiles` in `visit-pdf.js`. Een keten toevoegen betekent één configuratieobject toevoegen met `displayName`, `aliases`, `primary`, `secondary`, `soft` en eventueel `logo`. Zonder logo toont de banner altijd een nette tekstkop; er verschijnt nooit een kapotte afbeelding.

## Gebruikte databasevelden

De PDF-knop haalt bij ieder gebruik de actuele gegevens uit de bestaande tabellen op:

- `visit_history`: `customer_id`, `planning_id`, `bezoekdatum`, `starttijd`, `eindtijd`, `activiteit`, `samenvatting`, `opmerkingen`, `status`, `user_id` en eventueel later toegevoegde velden zoals `vervolgactie`;
- `planning`: datum, tijden, status, notities en klantkoppeling;
- `customers`: `keten`, `naam`, adresvelden, plaats en `contactpersoon`;
- `profiles`: naam/e-mail van de bezoeker;
- `visit_photos`: de Storage-paden die bij het betreffende historiebezoek horen.

Lege velden worden niet opgenomen. `planning.notities` blijft een opmerking en wordt niet automatisch als vervolgactie bestempeld. Alleen een expliciet vervolgactieveld of tekst met `Vervolgactie:`/`Follow-up:` wordt als vervolgactie getoond.

## Foto's ophalen

Foto's worden via de aangemelde Supabase-client uit bucket `visit-photos` gedownload. Dit werkt met de huidige bucket en blijft werken wanneer de bucket privé wordt gemaakt, mits de bestaande RLS-leesrechten blijven gelden. Als een directe geauthenticeerde download niet lukt, wordt een signed URL van vijf minuten geprobeerd. Een ontbrekende of onbereikbare foto wordt overgeslagen zonder kapotte afbeelding of technische tekst in de PDF.

## PDF-indeling

- A4 staand, met vaste header en footer;
- één pagina waar de inhoud leesbaar past;
- automatische vervolgpagina's voor lange tekst of meer dan acht foto's;
- dynamisch raster voor nul tot acht foto's op de eerste fotopagina;
- foto's behouden hun verhouding en blijven volledig binnen gelijke kaders;
- paginanummering wordt pas na volledige opbouw toegevoegd.

Op laptop wordt het rapport gedownload. Op iPhone wordt vóór de asynchrone gegevensophaalactie een leeg voorbeeldvenster geopend en daarna met de PDF gevuld, zodat iOS de normale deel- en bewaarfuncties beschikbaar houdt.

## Bekende beperking

Er zijn geen merkrechtengevoelige externe ketenlogo's meegeleverd. De bekende profielen gebruiken daarom een herkenbare, ketenspecifieke kleurenbanner met de officiële ketennaam. Later kan per profiel veilig een goedgekeurd logo worden toegevoegd.
