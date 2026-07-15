# Installatie Planning-GJsystems v11.3.0

## Voor de huidige omgeving

De Supabase-migratie voor v11.3.0 is al uitgevoerd en gecontroleerd. Je hoeft geen Node.js te installeren en je hoeft nu niets meer in Supabase uit te voeren.

1. Download of kopieer voor de zekerheid eerst de huidige GitHub-repository.
2. Pak `Planning-GJsystems-v11.3.0-GitHub.zip` uit.
3. Open GitHub en ga naar repository `Planningv2`.
4. Kies **Add file** > **Upload files**.
5. Sleep de volledige inhoud van de uitgepakte map naar GitHub. Upload de bestanden uit de hoofdmap, niet één extra bovenliggende map.
6. Controleer vóór het committen in ieder geval deze bestanden:
   - `.github/workflows/deploy-development-pages.yml`
   - `planning-core.js`
   - `laptop.html`
   - `mobile.html`
   - `v113.js`
   - `v113.css`
   - `SUPABASE_V11_3_RELEASE.sql`
7. Gebruik als commitmelding: `Release v11.3.0 - stabiele routes databasecontrole en historie`.
8. Klik op **Commit changes**.
9. Open **Actions** en wacht tot **Test en deploy Planning-GJsystems v11.3.0** volledig groen is. Een gele Node.js-waarschuwing van een GitHub Action is geen fout; een rode stap wel.
10. Open de app eerst eenmalig met `laptop.html?v=113000` en `mobile.html?v=113000`.
11. Sluit op iPhone de app volledig. Blijft een oud scherm zichtbaar, open de URL eenmaal in Safari en voeg het beginschermicoon daarna opnieuw toe.
12. Voer de vijf korte controles uit `TESTCONTROLE_V11.3.md` uit.

## Alleen voor een andere of nieuwe Supabase-omgeving

Voer daar in deze volgorde uit:

1. `SUPABASE_V10_7_DEV_BASELINE.sql`;
2. `SUPABASE_V11_1_RELEASE.sql`;
3. `SUPABASE_V11_2_RELEASE.sql`;
4. `SUPABASE_V11_3_RELEASE.sql`;
5. deploy `supabase/functions/admin-users/index.ts`;
6. deploy `supabase/functions/tomtom-proxy/index.ts` met platform-JWT-controle uit, omdat de functie zelf de actuele gebruikerssessie controleert;
7. stel de TomTom API-sleutel alleen via de beveiligde beheeractie in.

Zet nooit een service-role-key of TomTom-key in GitHub, `runtime-config.js` of browsercode.

