# Installatie v11.3.2

## 1. Supabase

1. Open het gebruikte Supabase-project.
2. Ga naar **SQL Editor** en maak een nieuwe query.
3. Kopieer de volledige inhoud van `SUPABASE_V11_3_2_RELEASE.sql`.
4. Klik op **Run**. De melding `Success. No rows returned` is goed.

Deze cumulatieve migratie bevat ook de v11.3.1-statuscorrecties. `SUPABASE_V11_3_RELEASE.sql` moet al zijn uitgevoerd. De migratie verwijdert geen geldige historie; alleen een ongeldige uitvoerstatus zonder historie wordt naar `Gepland` hersteld.

## 2. GitHub Pages

1. Pak `Planning-GJsystems-v11.3.2-GitHub.zip` uit.
2. Upload alle uitgepakte bestanden en mappen naar de hoofdmap van de repository en overschrijf de bestaande versie.
3. Gebruik bijvoorbeeld committekst `Release v11.3.2 - historie ZIP en volledig leegmaken`.
4. Wacht totdat de GitHub Action groen is.
5. Open `laptop.html?v=113200` en `mobile.html?v=113200` eenmaal rechtstreeks.
6. Sluit de iPhone-webapp volledig en open hem opnieuw, zodat de nieuwe service-worker-cache actief wordt.

## 3. Huidige oude gegevens

`SUPABASE_V11_3_2_RELEASE.sql` verwijdert geen echte uitgevoerde bezoeken. Wil je werkelijk helemaal opnieuw beginnen, gebruik dan na de update **Beheer → Alles resetten** en typ `BEVESTIG`. Die actie verwijdert klanten, planning, historie, fotokoppelingen en gekoppelde Storage-bestanden voor de gekozen werkruimte.

## 4. Snelle controle

1. Open een historiebezoek met foto’s.
2. Klik `Alle foto's opslaan (.zip)`.
3. Controleer of de ZIP klantnaam en datum bevat.
4. Controleer `Bezoekverslag.txt` en de losse foto’s.
5. Controleer op laptop én iPhone.

