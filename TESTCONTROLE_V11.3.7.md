# Testcontrole Planyx v11.3.7

Werkelijk uitgevoerd op 18 juli 2026:

- Manifest bevat naam, startadres, standalone weergave, thema en iconen.
- Alle HTML-ingangen verwijzen naar manifest en Apple Touch Icon.
- Appiconen bestaan in 180 × 180, 192 × 192 en 512 × 512 pixels.
- Productiebuild bevat manifest en alle appiconen.
- Service worker cachet de PWA-bestanden en vraagt actief om updates.
- `npm test`: **111 van 111 tests geslaagd**.
- `npm run build`: productie-deploymentmap succesvol gemaakt.
- De gebouwde deployment bevat het manifest en alle drie de appiconen.
