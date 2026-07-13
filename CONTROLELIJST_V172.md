# Controlelijst V172

## Automatisch gecontroleerd

- [x] `app.js` en `v172.js` zijn syntactisch geldig.
- [x] 4×4 bevat 16 vakjes.
- [x] 5×5 bevat 25 vakjes en één vrij middenvak.
- [x] 6×6 bevat 36 vakjes.
- [x] Per kaart verschilt het aantal vakjes per kleur maximaal één.
- [x] Bingo werkt dynamisch voor rijen, kolommen en diagonalen bij alle drie formaten.
- [x] Iedere kleur wordt één keer getrokken voordat de shuffle-zak opnieuw begint.
- [x] Op de grens van twee shuffle-zakken wordt een directe kleurherhaling voorkomen.
- [x] Enter en Return activeren de verzendknop niet.
- [x] Envelop- en grafiekiconen ontbreken in de bron en worden ook uit oude dynamische renderlagen verwijderd.
- [x] PWA-zoom is via viewport, knijpgebaar, dubbelklik en toetsencombinaties geblokkeerd.
- [x] De Spotify-callback blijft verborgen achter het groene overgangsscherm.
- [x] Spelers kunnen alleen vanuit de lobby na een bevestiging stoppen.
- [x] Na stoppen worden kamer-, bingo- en Spotify-testlisteners afgesloten.
- [x] Alleen de host krijgt vervolgkeuzes na een bingo.
- [x] Host-doet-mee kan stabiel terug naar het hostscherm.

## DOM-integratietest

- [x] Volledige V171-scriptvolgorde samen met V172 geladen.
- [x] 6×6-lobbykaart bevat daadwerkelijk 36 DOM-vakjes.
- [x] STOPPEN-knop verschijnt daadwerkelijk in de lobby.
- [x] Antwoordveld wordt bij `answering` opgebouwd en gefocust.
- [x] Een Enter-event op het antwoordveld veroorzaakt nul knopklikken.

## Praktische eindcontrole na upload

- [ ] Eén ronde op een fysieke iPhone: toetsenbord opent bij timerstart.
- [ ] Eén ronde op Android: bestaand toetsenbordgedrag blijft werken.
- [ ] Spotify-login met de echte redirect-URL: geen oud tussenscherm zichtbaar.
- [ ] Twee echte spelers: één speler stopt, andere speler speelt verder.
- [ ] Host-doet-mee: bingo, daarna zowel **Verder spelen** als **Nieuwe ronde** proberen.
