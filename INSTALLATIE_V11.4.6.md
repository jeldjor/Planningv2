# Installatie Planyx v11.4.6

1. Upload alle bestanden uit deze release naar de bestaande GitHub-repository.
2. Open het gekoppelde Supabase-project.
3. Open **SQL Editor**, kies **New query** en plak de volledige inhoud van SUPABASE_V11_4_6_COURIER.sql.
4. Klik één keer op **Run**. De SQL is herhaalbaar en zet uitsluitend het opgegeven account in koeriersmodus.
5. Publiceer de bestaande tomtom-proxy Edge Function opnieuw als de meegeleverde functie nieuwer is dan de online versie.
6. Wacht tot GitHub Actions/de deployment groen is en open Planyx één keer opnieuw.
7. Log in als de koerier, stel onder **Instellingen** het startadres in en importeer daarna het Excelbestand.

De TomTom API-key blijft uitsluitend in app_server_settings/de serverfunctie. Zet nooit een service-role-key of TomTom-key in browserbestanden.

