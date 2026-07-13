# Uitgevoerde PDF-controle v10.10

Alle scenario's zijn als echte A4-PDF gegenereerd, met Poppler naar PNG gerenderd en visueel gecontroleerd. De bestanden staan onder `output/pdf/` en het resultaat per scenario staat in `pdf-test-manifest.json`.

| Scenario | Resultaat |
| --- | --- |
| Bijenkorf met 4 foto's | Geslaagd - juiste profiel, 2 x 2 raster, 1 pagina |
| Scapino met 8 foto's | Geslaagd - juiste profiel, 4 x 2 raster, 1 pagina |
| Intersport met 2 foto's | Geslaagd - ketenveld kiest Intersport, 1 pagina |
| Van Tilburg Sport met 6 foto's | Geslaagd - juiste profiel, 3 x 2 raster, 1 pagina |
| Onbekende keten | Geslaagd - algemene Stichd-template |
| Bezoek zonder foto's | Geslaagd - fotoblok volledig verborgen |
| Bezoek met 1 foto | Geslaagd - groot enkel fotokader |
| Niet uitgevoerd met reden | Geslaagd - rode statusbadge en reden als database-inhoud |
| Lange samenvatting | Geslaagd - automatische tweede pagina, geen afkapping |
| Ontbrekende contactpersoon | Geslaagd - label wordt niet getoond |
| Ontbrekend logo | Geslaagd - tekstheader zonder kapotte afbeelding |
| Ontbrekende/onbereikbare foto | Geslaagd - ongeldige foto overgeslagen |
| Meer dan 8 foto's | Geslaagd - eerste 8 en vervolgfoto's op volgende pagina |
| Laptop openen/downloaden | Geslaagd - lokale jsPDF, geldige Blob/download zonder lege pagina |
| iPhone openen/delen | Geslaagd in gesimuleerd iOS-openpad - vooraf geopend venster ontvangt Blob-URL |

Per PDF zijn klant, ketenprofiel, vestigingsnaam, datum, status, bezoeker, fotoaantal, template, A4-formaat en paginanummers gecontroleerd. De gerenderde contactbladen zijn gecontroleerd op overlap, afgesneden tekst, beeldvervorming en lege placeholders.

De regressiesuite controleert daarnaast dat de bestaande bezoek-, foto-, rapportage-, database-, laptop-, iPhone-, Storage-, rechten- en downloadcode geladen blijft.
