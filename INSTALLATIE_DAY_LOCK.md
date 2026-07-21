# Installatie dag uit planning en datumvergrendeling

1. Upload de volledige inhoud van deze ZIP naar dezelfde GitHub-repository en laat bestaande bestanden vervangen.
2. Open Supabase → SQL Editor.
3. Open `SUPABASE_V11_3_8_DAY_LOCK.sql`, kopieer de volledige inhoud en voer die één keer uit.
4. Vernieuw Planyx op laptop en iPhone. Bij een geïnstalleerde PWA kan één keer volledig sluiten en opnieuw openen nodig zijn.

Daarna staat bij de dagplanning **Hele dag uit planning**. Alleen openstaande opdrachten worden uit de dag gehaald. Uitgevoerde en niet-uitgevoerde opdrachten blijven op hun oorspronkelijke datum staan en kunnen niet meer worden gesleept, herpland of uit planning worden gehaald. De bestaande beheeracties **Planning leegmaken** en **Alles resetten** kunnen ze nog wel verwijderen.

Belangrijk: voer het SQL-bestand uit voordat je de nieuwe knop gebruikt. De vergrendeling zit bewust ook in Supabase, zodat een ander apparaat of oude geopende app een uitgevoerde opdracht evenmin kan verplaatsen.
