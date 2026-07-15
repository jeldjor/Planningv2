# Installatie Planning-GJsystems v11.2.0

## Voor de huidige omgeving

De Supabase-migratie en de nieuwe `tomtom-proxy` zijn al uitgevoerd. Installeer geen Node.js en voer niets meer handmatig in Supabase uit.

1. Maak voor de zekerheid een kopie van de huidige GitHub-repository of download de huidige repository als ZIP.
2. Pak `Planning-GJsystems-v11.2.0-GitHub.zip` uit.
3. Open GitHub en ga naar de repository `Planningv2`.
4. Kies **Add file** > **Upload files**.
5. Sleep de volledige inhoud van de uitgepakte map naar GitHub. Upload dus de bestanden en mappen in de hoofdmap, niet één extra bovenliggende map.
6. Controleer vóór het opslaan dat ook deze bestanden zichtbaar zijn:
   - `.github/workflows/deploy-development-pages.yml`
   - `planning-core.js`
   - `mobile.html`
   - `laptop.html`
   - `supabase/functions/tomtom-proxy/index.ts`
   - `SUPABASE_V11_2_RELEASE.sql`
7. Gebruik als commitmelding: `Release v11.2.0 - centrale TomTom route-engine`.
8. Klik op **Commit changes**.
9. Open **Actions** en wacht tot **Test en deploy Planning-GJsystems v11.2.0** volledig groen is. De waarschuwing dat enkele GitHub Actions intern Node.js 20 gebruiken is geen testfout; alleen een rode stap is fout.
10. Open de app eerst met `?v=112000`, bijvoorbeeld `laptop.html?v=112000` en `mobile.html?v=112000`.
11. Sluit op iPhone eventueel het oude beginschermicoon volledig, open Safari eenmaal met de nieuwe URL en voeg daarna het beginschermicoon opnieuw toe als de oude cache zichtbaar blijft.
12. Voer de vijf gebruikerscontroles uit `TESTCONTROLE_V11.2.md` uit.

## Alleen voor een andere of nieuwe Supabase-omgeving

Voer daar achtereenvolgens uit:

1. `SUPABASE_V10_7_DEV_BASELINE.sql`;
2. `SUPABASE_V11_1_RELEASE.sql`;
3. `SUPABASE_V11_2_RELEASE.sql`;
4. deploy `supabase/functions/admin-users/index.ts`;
5. deploy `supabase/functions/tomtom-proxy/index.ts` met platform-JWT-controle uit, omdat de functie zelf de actuele gebruikerssessie controleert;
6. stel de TomTom API-sleutel uitsluitend via de bestaande beveiligde beheeractie in.

Zet nooit een service-role-key of TomTom-key in GitHub, `runtime-config.js` of browsercode.
