# Controlelijst Planyx v11.4.6

## Account en beveiliging

- [x] Alleen account 7b870312-0fd3-4d7c-add6-5bb25588f2de krijgt app_mode courier.
- [x] Andere accounts behouden de bestaande Planningv2-weergave en regels.
- [x] Koeriersopdrachten, adrescorrecties en routes zijn per user_id afgeschermd met RLS.
- [x] app_mode kan niet door een gewone gebruiker worden verhoogd of gewijzigd.
- [x] Admin-voordoen-als gebruikt het werkruimteprofiel en de juiste user_id.

## Import

- [x] De 51 aangeleverde kolommen worden geaccepteerd; alleen bezorgvelden worden getoond.
- [x] cargoid is de primaire importidentiteit; c_id is de terugval.
- [x] Opnieuw importeren maakt geen dubbele opdracht.
- [x] Bezorgd en Uit route blijven bij opnieuw importeren behouden.
- [x] d_address1 met volledig adres werkt.
- [x] d_address1 straat plus d_address2 huisnummer/toevoeging werkt.
- [x] d_country Netherlands wordt automatisch NL als d_country_code leeg is.
- [x] Negen cijfers uit een Nederlands Excel-telefoonveld krijgen de ontbrekende begin-0 terug.
- [x] koerier_user_id uit de bronexport filtert geen zelf geïmporteerde opdrachten weg.

## TomTom-adrescontrole

- [x] Nieuwe en gewijzigde adressen worden voor routegebruik gecontroleerd.
- [x] Gelijke straat, huisnummer inclusief toevoeging en postcode worden automatisch geldig.
- [x] Een afwijkend huisnummer, toevoeging, straat of postcode vereist goedkeuring.
- [x] Pop-up toont ingevoerd adres en TomTom-voorstel naast elkaar.
- [x] Voorstel goedkeuren, zelf aanpassen, later controleren en niet meenemen zijn aanwezig.
- [x] Ongeldige adressen blokkeren routeoptimalisatie totdat ze zijn opgelost of uitgesloten.
- [x] Goedgekeurde adrescorrecties worden hergebruikt.

## Koeriersroute

- [x] Alleen naam, bedrijf indien aanwezig, adres en telefoon worden getoond.
- [x] Navigeren, Bezorgd en Uit route zijn direct beschikbaar.
- [x] Alleen resterende geldige opdrachten worden opnieuw geoptimaliseerd.
- [x] Twee minuten per afleveradres.
- [x] Geen pauze, parkeerbuffer, openingstijden, maximale werkduur of klantmaximum.
- [x] Startadres, eventueel ander eindadres, vertrektijd en navigatie-app zijn accountinstellingen.
- [x] Meer dan 29 adressen wordt in veilige TomTom-delen verwerkt.
- [x] Een onvolledige route wordt niet gedeeltelijk opgeslagen.

## Technische controle

- [x] Volledige bestaande regressiesuite geslaagd: 146 van 146 tests.
- [x] Aanvullende koerierstests geslaagd, inclusief 65 TomTom-trajecten.
- [x] Productiebouw bevat courier.js en courier.css.
- [x] Service worker neemt beide koeriersbestanden mee.
- [x] Bestaande beschermde v10.7-modules zijn byte-identiek gebleven.

