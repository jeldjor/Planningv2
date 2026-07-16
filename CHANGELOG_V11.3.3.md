# Changelog v11.3.3

## iPhone-PDF

- Opgelost: `PDF maken mislukt: Can't find variable: db`.
- De PDF-integratie leest de mobiele gegevens nu via `window.GJ_MOBILE.state()`.
- De laptop blijft dezelfde centrale PDF-generator gebruiken.

## Historie

- Iedere historiekaart op iPhone heeft nu een knop **PDF**.
- Het geopende historievenster heeft daarnaast een knop **PDF maken**.
- Beide knoppen gebruiken het centrale historie-ID en laden klant, bezoekgegevens en foto's uit Supabase.

## Cache en regressie

- Release-assets zijn verhoogd naar cacheversie `113300`.
- De service-workercache is verhoogd naar `v11.3.3-r1`.
- Er zijn regressietests toegevoegd voor de mobiele state en beide historieknoppen.
- Voor deze hotfix is geen aanvullende Supabase-SQL nodig.
