# Frontend: bygg-siden

**Hva:** Ny bygg-side (`#/bygg/{bygningsnummer}`) med én seksjon per ordning, søylediagram over karakterfordeling, oppvarmingskarakter, sammenligning med lignende bygg, forklaring og utskriftsknapp. Kartpopupen har fått lenken «Vis bygget». Hash-ruting i ny `Router.jsx`.

**Hvorfor:**
- Hash-ruting uten ruter-pakke, som avtalt. `#/` (tom hash) viser kartet som før. Kartet laster inn på nytt når man går tilbake (komponenten fjernes mens bygg-siden vises); alternativet, å holde kartet skjult, kan ødelegge kartstørrelsen.
- Popupen viser ikke bygningsnummer, men har attestnummer. Lenken går derfor til `#/bygg-fra-attest/{attestnummer}`. Den siden kaller `fra-attest` og bytter deretter hashen til `#/bygg/{bygningsnummer}` (`location.replace`, så tilbake-knappen ikke havner i en blindvei).
- Testdata (`src/dev/bygg-oversikt-eksempel.json`) brukes bare med `?eksempel=1`, aldri som stille reserve ved feil. Ved feil/404 vises «Fant ikke bygget».
- Alle tall kommer ferdig fra API-et. Nettleseren gjør bare formatering: «0,7» blir «7 av 10», og søylehøyde skaleres mot største søyle.
- Søylediagrammet er ren CSS (ingen nye pakker). Antall står over hver søyle, så det er lesbart i svart-hvitt-utskrift.
- Utskrift: `@media print` skjuler verktøylinje, kart, popup og knapper, setter A4 med 15 mm marg og tvinger søylefargene til å skrives ut.

**Testet:**
- `npx vite build --outDir <midlertidig mappe>`: OK (kun den vanlige advarselen om stor pakke). `Frontend/dist` er urørt.
- `npm run dev` + `?eksempel=1#/bygg/80000000`: PC-bredde og 375 px sjekket med skjermbilde (testdata). Ingen horisontal rulling på 375 px (scrollWidth = 375). Begge ordninger vises, `nok_data: false` gir «for få lignende bygg», oppvarmingskarakter vises bare for gammel ordning.
- Uten `?eksempel=1` og uten backend: «Fant ikke bygget» med lenke tilbake. `#/` viser kartet igjen.
- Ikke tatt med Playwright (ikke installert); brukte Claudes nettleserpanel.

**Usikkert:**
- Siden er ikke testet mot ekte API. Feltnavn og typer er bare lest fra `docs/api-kontrakt.md`.
- Lenken «Vis bygget» i popupen og `fra-attest`-oppslaget er ikke klikket gjennom i nettleseren (popupen krever kartdata fra backend). Det er bare kodet og bygget.
- Utskriftsforhåndsvisning er ikke sett visuelt (panelet kan ikke åpne den). `@media print`-reglene er skrevet, men bør sjekkes med Ctrl+P.
- Forklaringen av oppvarmingskarakter («hvor miljøvennlig oppvarmingen er») er min forenkling; kontrakten sier bare at den har fargene Green til Red. Eieren bør godkjenne ordlyden. Det samme gjelder «A er best, G er dårligst» for ny ordning.
- Hvis `lignende.grunnlag` er «bare kategori», skrives kategorien med små bokstaver («i alle boligblokker»). Kategorinavn i entall eller andre former kan gi stiv norsk.
- Popupen i `MapView.jsx` er ellers på engelsk (utenfor oppgaven; bare lenken er norsk). `oversetter` bør ta resten.
- Median for lignende bygg vises i tillegg til det oppgaven ba om (`lignende.median_kwh_m2` finnes i kontrakten).

**Lær dette:** *Hash-ruting* bruker delen av URL-en etter `#`. Nettleseren laster ikke siden på nytt når den endres, og `hashchange`-hendelsen lar appen bytte visning uten ruter-pakke eller serveroppsett. *`@media print`* er CSS som bare gjelder ved utskrift/PDF. Her skjuler den alt som ikke hører hjemme på papiret og setter sidestørrelsen med `@page`.

## Rettet etter reviewer
- «leiligheter» er byttet med «enheter» overalt (unntatt som eksempel i forklaringen av «enhet»). Kategorinavnet skrives nå i anførselstegn med original skrivemåte: «i kategorien «K» fra samme byggeperiode (kohort)» (trinn 1) og «… uansett byggeår» (trinn 2).
- «X av 10» er erstattet med hele prosent, med «under 5 %» og «over 95 %» i ytterpunktene. `andel_enheter_bedre_enn_lignende` vises som «X av N enheter i bygget», der N er `antall_enheter` i ordningen og X er andelen ganget med N (avrunding for visning).
- Tallene kalles «beregnet energibehov», ikke energibruk, og forklaringen sier at karakteren bygger på beregnet energibehov per m² per år, ikke målt forbruk.
- `nok_data: false` sier nå hvilket grunnlag som ble prøvd og hvor mange enheter det hadde. Ukjent kategori (`grunnlag` null) sjekkes først og gir «Bygningskategorien er ukjent, så bygget kan ikke sammenlignes.»
- Fakta-linjen: «bygget i 1962 (byggeperiode: 1949–1969)». Overskriften viser første adresse og «og N andre innganger», med full liste i en mindre linje under.
- Ikke testet: tekstvarianten for ukjent kategori (testdata har ingen rad med `grunnlag: null`).

### Andre runde (eierens ønsker)
- Kontrakten 4ca5d51 er flettet inn. «X av N enheter i bygget» bruker nå `antall_enheter_bedre_enn_lignende` og `antall_enheter_med_energitall` direkte; all utregning i nettleseren er fjernet. Linjen vises bare når begge er satt.
- Andelssetningen har tre varianter: under 5 % («Nesten alle lignende enheter (over 95 %) har lavere beregnet energibehov enn bygget.»), over 95 % («Bygget har lavere … enn nesten alle lignende enheter (over 95 %).») og ellers «… enn X % av lignende enheter.». Setningen «X av N» har ingen prosent og trenger ingen ytterpunktvariant.
- Testdata: `?eksempel=<navn>` velger variant (`standard`, `ukjent-kategori`, `under5`, `over95`, `en-enhet`); `?eksempel=1` er det samme som `standard`. Ukjent navn gir «Fant ikke bygget», ikke stille reserve. Filene ligger i `Frontend/src/dev/`.
- Sjekket i nettleseren (Claudes panel, ren tekstkontroll):
  - standard / `1`: «1 480 enheter i 62 bygg i kategorien «Boligblokker» fra samme byggeperiode», «enn 70 % av lignende enheter», «14 av 23 enheter i bygget …». Ny ordning: «for få … bare 4 enheter i kategorien «Boligblokker» uansett byggeår».
  - ukjent-kategori: «Ukjent bygningskategori, ukjent byggeår» og «Bygningskategorien er ukjent, så bygget kan ikke sammenlignes.»
  - under5: «Nesten alle lignende enheter (over 95 %) har lavere beregnet energibehov enn bygget.» og «0 av 12 enheter …».
  - over95: «Bygget har lavere beregnet energibehov enn nesten alle lignende enheter (over 95 %).» og «19 av 20 enheter …»; to adresser vises som «Eksempelveien 4A og 1 annen inngang».
  - en-enhet: bare andelssetningen («45 %») og medianen; ingen «X av N»-linje.
