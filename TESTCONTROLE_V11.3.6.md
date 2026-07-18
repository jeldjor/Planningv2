# Testcontrole Planyx v11.3.6

Werkelijk uitgevoerd op 18 juli 2026:

- `npm test`: **108 van 108 tests geslaagd**.
- `npm run build`: deploymentmap succesvol gemaakt.
- Planyx staat als titel in `index.html`, `mobile.html` en `laptop.html`.
- Login- en iPhone-opstartscherm verwijzen naar het nieuwe Planyx-beeld.
- iPhone-menu en laptopzijbalk verwijzen naar GJ Motion.
- Beide merkbestanden staan byte-identiek in de gebouwde deploymentmap.
- De service worker cachet de nieuwe merkbestanden en verwijdert de oude app-shellcache.
- De bestaande PDF-footer blijft volgens de eerdere afspraak `GJsystems`.
- De volledige regressieset voor planning, TomTom, Supabase, historie, foto's, PDF en beide apparaten is geslaagd.

Voor deze release is geen Supabase-wijziging nodig.
