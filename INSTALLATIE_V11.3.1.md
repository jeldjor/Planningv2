# Installatie v11.3.1

## 1. Supabase

1. Open het gekoppelde Supabase-project.
2. Ga naar **SQL Editor** en kies **New query**.
3. Open `SUPABASE_V11_3_1_RELEASE.sql` uit deze release.
4. Kopieer de volledige inhoud, plak die in de SQL Editor en klik **Run**.
5. De melding **Success. No rows returned** is correct. Het script is herhaalbaar.

Dit script voegt geen tabel of kolom toe. Het maakt de beveiligde functie waarmee een bestaande bezoekhistorie, status en werkelijke uitvoeringsdatum worden aangepast. Het herstelt ook planningregels die ten onrechte `Uitgevoerd` zijn zonder historierij en blokkeert dat dit opnieuw gebeurt.

## 2. GitHub Pages

1. Pak `Planning-GJsystems-v11.3.1-GitHub.zip` uit.
2. Upload **alle uitgepakte bestanden en mappen** naar de hoofdmap van de GitHub-repository. Upload niet alleen het ZIP-bestand en meng geen losse bestanden uit v11.3.0.
3. Gebruik bijvoorbeeld committekst `Release v11.3.1 - wachttijd historie foto en keten-PDFs`.
4. Wacht in **Actions** totdat `test-and-deploy` volledig groen is.
5. Open daarna eenmaal `laptop.html?v=113100` en `mobile.html?v=113100`.
6. Sluit de iPhone-webapp volledig en open hem opnieuw, zodat de nieuwe app-shell wordt geladen.

## 3. Korte live controle

1. Open een groene dag op laptop en iPhone en controleer dezelfde kilometers, reistijd en wachttijd.
2. Open een reeds afgerond bezoek, wijzig alleen de uitvoeringsdatum en controleer dat de planningsdag niet verhuist.
3. Kies op iPhone een foto, verwijder één foto en open het bezoek opnieuw.
4. Maak een PDF en controleer dat de foto rechtop staat en alleen de bezoekdatum wordt vermeld.
5. Voor bestaande routes die vóór v11.3.1 zijn berekend verschijnt wachttijd na de eerstvolgende routeherberekening. Ongewijzigde groene routes worden daarna opnieuw hergebruikt.
6. Maak op iPhone een afwezigheid van 08:00 tot 10:00 op dezelfde datum; controleer dat de eerste klant pas na afwezigheid plus de live reistijd begint en dat wijzigen/verwijderen opnieuw rekent.
