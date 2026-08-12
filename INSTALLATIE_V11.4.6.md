# Installatie Planyx v11.4.6

1. Upload alle bestanden uit deze release naar de bestaande GitHub-repository.
2. Open het gekoppelde Supabase-project.
3. Open **SQL Editor**, kies **New query** en plak de volledige inhoud van SUPABASE_V11_4_6_COURIER.sql.
4. Klik één keer op **Run**. De SQL is herhaalbaar en zet uitsluitend het opgegeven account in koeriersmodus.
5. Publiceer de bestaande tomtom-proxy Edge Function opnieuw als de meegeleverde functie nieuwer is dan de online versie.
6. Wacht tot GitHub Actions/de deployment groen is en open Planyx één keer opnieuw.
7. Log in als de koerier, stel onder **Instellingen** het startadres in en importeer daarna het Excelbestand.

## Aanvullende correctie R2

1. Voer eenmalig `SUPABASE_V11_4_6_COURIER_PATCH_R2.sql` uit in de SQL Editor.
2. Open in Supabase **Edge Functions → tomtom-proxy → Code**.
3. Vervang de code door de volledige inhoud van `supabase/functions/tomtom-proxy/index.ts` en kies **Deploy function**.
4. Upload de R2-frontendbestanden naar GitHub en wacht tot de deployment groen is.

## Routecorrectie R4

R4 wijzigt opnieuw `tomtom-proxy`. Vervang daarom in **Supabase → Edge Functions → tomtom-proxy → Code** de volledige code door `supabase/functions/tomtom-proxy/index.ts` uit de R4-update en klik op **Deploy function**. Voor R4 is geen aanvullende SQL nodig.

De TomTom API-key blijft uitsluitend in app_server_settings/de serverfunctie. Zet nooit een service-role-key of TomTom-key in browserbestanden.
