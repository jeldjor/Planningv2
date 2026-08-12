# Planyx v11.4.6 – koeriersaccount

- RouteRunner-account 28ccccdc-b7ef-4397-a01f-f1218f5303b7 (`info@routerunner-direct.com`) krijgt na de release-SQL een eigen koerierswerkruimte; het beheeraccount blijft de normale Planyx-werkruimte gebruiken.
- R2 accepteert adressen automatisch wanneer postcode en volledig huisnummer overeenkomen, ook wanneer TomTom plaatsnamen of schrijfwijze anders presenteert.
- R2 laat TomTom de tussenstops optimaliseren en ondersteunt een vaste eerste en/of laatste klant.
- De routevolgorde kan met de sleepgreep handmatig worden gewijzigd; tijden en afstanden worden daarna opnieuw berekend.
- De koeriersweergave bevat een overzichtskaart met start, alle genummerde stops en het eindpunt.
- R3 voegt **Alles leegmaken** toe. Daarmee worden na bevestiging alle bezorgopdrachten en routeberekeningen van uitsluitend de aangemelde koerierswerkruimte verwijderd; instellingen en goedgekeurde adrescorrecties blijven bewaard.
- De bestaande veldserviceweergave en regels blijven voor alle andere accounts ongewijzigd.
- Excel/CSV-import ondersteunt de aangeleverde transportexport en gebruikt cargoid, met c_id als terugval.
- d_address1 en d_address2 worden veilig samengevoegd met postcode, plaats en land.
- Nederlandse telefoonnummers die Excel als negen cijfers exporteert krijgen de ontbrekende begin-0 terug.
- Nieuwe of gewijzigde adressen worden vóór routegebruik via TomTom gecontroleerd.
- Een afwijkend TomTom-voorstel wordt nooit stil toegepast: eerst goedkeuren, zelf aanpassen of uitsluiten.
- Goedgekeurde adrescorrecties worden per account hergebruikt.
- De koeriersroute gebruikt twee minuten per stop en kent geen pauze, openingstijden, maximale werkdag of klantlimiet.
- Bezorgd en Uit route blijven bewaard bij een volgende import van dezelfde cargoid.
- Grote routes worden intern in TomTom-delen van maximaal dertig trajecten berekend en pas na een volledig resultaat opgeslagen.
