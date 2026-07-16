# Testcontrole v11.3.5

## Automatisch uitgevoerd

- Volledige Node-testsuite: 104 tests geslaagd.
- PDF-generatie: 22 scenario's gegenereerd.
- Productiebouw: geslaagd.
- Laptop- en iPhone-PDF-code gebruiken dezelfde generator.
- Alle dertien bekende ketens herkennen hun eigen banner.
- Onbekende keten gebruikt de algemene Stichd-template.
- Bezoekgegevens bevatten precies één datum en geen start- of eindtijd.
- Footer herhaalt de datum niet en toont uitsluitend `GJsystems` met daarnaast alleen het paginanummer.
- Dubbele samenvatting/opmerkingen worden gefilterd.
- 0, 1, 2, 3, 4, 5-6, 7-8 en meer dan 8 foto's worden ondersteund.
- Ontbrekende contactpersoon, banner of foto veroorzaakt geen kapot element.
- Lange tekst en vervolgpagina's worden zonder afsnijden opgebouwd.

## Visueel gecontroleerd

- Van Haren met brede banner en 4 foto's.
- de Bijenkorf met oorspronkelijke brede banner en 4 foto's.
- Scapino met 8 foto's.
- Onbekende keten met algemene Stichd-header.
- INNO zonder foto's.
- Lange samenvatting met 4 foto's.
- Meer dan 8 foto's met correcte tweede pagina en paginanummers.

Bij de controles zijn geen overlappende tekst, afgesneden secties, kapotte afbeeldingen of foto’s buiten hun kader aangetroffen.

## Nog éénmalig live controleren na GitHub-publicatie

- PDF openen en delen via Safari/iOS op de eigen iPhone.
- PDF downloaden/openen in de gebruikte laptopbrowser.
- Een echt historiebezoek met private Supabase-foto's genereren.
