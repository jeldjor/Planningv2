# Edge Functions voor het development/testproject

Deze functies leveren de twee beveiligde serverfuncties van v11.0:

- `admin-users`: gebruikers tonen, maken, activeren en wachtwoord wijzigen;
- `tomtom-proxy`: beveiligde TomTom-geocoding en individuele of gebundelde dagrouteberekening (`route-batch`).

Koppel de Supabase CLI uitsluitend aan het nieuwe testproject en controleer de project-ref vóór iedere deploy. Supabase levert `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` automatisch aan de serverruntime. Zet de service-role-key nooit in frontendbestanden, GitHub-variabelen voor de browser of `runtime-config.js`.
