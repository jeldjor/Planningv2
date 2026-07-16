# Changelog v11.3.4

## Winkelbezoek-PDF

- De vijf eerder aangeleverde banners voor de Bijenkorf, Scapino, INNO, Intersport en Van Tilburg Sport zijn teruggehaald en toegevoegd.
- De acht aangeleverde banners voor Van Haren, Bomont, DAKA, E5, Molecule, Torfs, Veritas en Berden blijven behouden.
- Iedere bekende keten gebruikt nu automatisch een banner met ketennaam en winkelbeeld op basis van het centrale databaseveld `Keten`.
- De banner staat links over twee derde van de paginabreedte; rechts worden actuele bezoekgegevens uit de database getoond.
- Alleen de bezoekdatum wordt vermeld. Start- en eindtijd worden niet in het verslag afgedrukt.
- Foto's worden vóór PDF-opbouw rechtop gezet en centraal naar 4:3 uitgesneden.
- De foutgevoelige PDF-clipping is verwijderd, zodat foto's niet meer buiten hun kader of over tekst heen kunnen vallen.
- De ruimtecontrole gebruikt voortaan de werkelijke hoogte van het fotoraster en maakt zo nodig eerst een vervolgpagina.
- De algemene Stichd-template blijft de terugval voor onbekende of lege ketens.

## Technisch

- Nieuwe asset: `assets/chain-banners-core.png`.
- PDF- en app-cache verhoogd naar v11.3.4 / `113400`.
- Geen nieuwe Supabase-migratie nodig.
