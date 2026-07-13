# Edge Functions voor het development/testproject

Deze functies herstellen de twee serverfuncties die de bestaande v10.7-frontend al aanroept:

- `admin-users`: gebruikers tonen, maken, activeren en wachtwoord wijzigen;
- `tomtom-proxy`: beveiligde TomTom-geocoding en routeberekening.

Koppel de Supabase CLI uitsluitend aan het nieuwe testproject en controleer de project-ref vóór iedere deploy. Supabase levert `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` automatisch aan de serverruntime. Zet de service-role-key nooit in frontendbestanden, GitHub-variabelen voor de browser of `runtime-config.js`.
