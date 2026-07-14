# Testcontrole Planning-GJsystems v11.1.0

## Geautomatiseerd uitgevoerd

- 62 unit-, integratie-, beveiligings-, UI- en regressietests: geslaagd.
- Alle inline JavaScript van laptop en iPhone compileert: geslaagd.
- Edge Functions TypeScript-syntax: geslaagd.
- Werkruimtefiltering van Realtime: geslaagd.
- Geen automatische alle-dagen-routeherberekening na synchronisatie: geslaagd.
- Mobiele Live Locaties-paneelstructuur en zichtbaarheid: geslaagd.
- 30-minuten livevolgcontract en databasegrens: geslaagd.
- Database-eerst afronden, enkelvoudige knopkoppeling, foto-idempotentie en mobiele rollback: geslaagd.
- Centrale dagroute thuis-klanten-thuis, terugrit, afwezigheid en pauze: geslaagd.
- Atomaire planningsperiode en complete-dagverplaatsing: contractcontrole geslaagd.
- Productiebouw: geslaagd.

## PDF uitgevoerd

- 14 scenario's gegenereerd, waaronder alle gevraagde ketens, 0/1/2/4/6/8/>8 foto's, onbekende keten, ontbrekend logo/foto, niet uitgevoerd en lange samenvatting.
- 16 PDF-pagina's met Poppler naar PNG gerenderd en visueel als contactblad gecontroleerd.
- Geen overlap, afgesneden tekst, kapotte afbeelding, vervormd kader of ontbrekende paginering waargenomen.
- Gesimuleerde iPhone Blob-weergave: geslaagd.

## Nog éénmalig live bevestigen

- `SUPABASE_V11_1_RELEASE.sql` uitvoeren op het gekoppelde Supabase-project.
- Edge Functions `admin-users` en `tomtom-proxy` opnieuw deployen.
- Op echte laptop: planning van vier bezoeken genereren en bevestigen dat iedere dag direct groen wordt.
- Op echte iPhone: volgorde, tijd en vertrektijd wijzigen en dezelfde tijden/km/reistijd op laptop vergelijken.
- Complete dag verslepen, beide apparaten vernieuwen en bevestigen dat de nieuwe datum blijft staan.
- Bezoek met twee foto's afronden en na uit-/inloggen status, historie en één exemplaar per foto controleren.
- Live Locaties openen, gebruiker inschakelen, toestemming accepteren en 30-minutensessie starten.
- PDF op laptop en in iOS-weergave openen/delen.

Een browserbouwomgeving kan iOS-achtergrondbeperkingen, GPS, echte TomTom-respons en het gekoppelde productieproject niet fysiek simuleren. Daarom zijn deze live controles niet als uitgevoerd gemarkeerd.
