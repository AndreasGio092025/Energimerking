# Oversetter: norsk tekst i kart-appen

Gren: `oversett-appen` (fra `bygg-side`, d8f8cc9)

## Hva
All engelsk tekst brukeren ser eller hører (inkludert `aria-label`, `title`, `placeholder`, tooltips og kartkontroller) i `Frontend/src/` er oversatt til bokmål. Bygg-siden (`ByggSide.jsx`, `ByggFraAttest.jsx`) var allerede norsk og er ikke endret. Ingen API-felt, dataverdier eller CSS-klasser er endret, og logikken er bare rørt på tre bevisste punkter (`heatingGradeName()`, MapLibre-`locale`, `upgradePriority`-tekstene; se Hvorfor).

## Hvorfor
- Ordlisten fra oppdraget er brukt likt overalt (se under). Beregnet energibehov brukes om kWh/m²; ordet «forbruk» er ikke brukt.
- To små tilleggsgrep som teknisk er mer enn ren tekst, men bare påvirker det brukeren leser:
  1. `heatingGradeName()` og `HEATING_GRADE_NAMES` i `utils/constants.js`: viser dataverdien `GREEN`/`RED`/… som «grønn»/«rød»/… i filter, popup og statistikk. Dataverdiene i state og API er uendret.
  2. `locale` i `new maplibregl.Map(...)`: MapLibre sine egne knapper («Zoom in» osv.) fikk norske tekster. Bare tekststrenger.
- `upgradePriority` i `filtering.js` ('High'/'Medium'/'Low') ble bare brukt som badge-tekst i popupen, og er derfor oversatt til «Høy/Middels/Lav prioritet». Verdien brukes ikke i noen sammenligning (sjekket med søk).
- Forkastet: å endre `toLocaleString()` til `'nb-NO'` (ville vært logikk).

## Ordliste
energy grade → energikarakter; heating grade → oppvarmingskarakter (grønn, lysegrønn, gul, oransje, rød); energy use → beregnet energibehov (kWh/m²); certificate → energiattest/attest; unit → enhet; build year/Built → byggeår; heatmap → varmekart; clusters → klynger; radius search → søk i radius; upgrade priority → oppgraderingsprioritet; Avg → gjennomsnittlig; Median → median; Typical → typisk (merket «(median)», siden tallet er median); N/A / Missing / Not registered → Mangler / Mangler / Ikke registrert; certificate scheme/method → ordning (gammel/ny).

## Endringer fil for fil (engelsk → norsk)

**`utils/constants.js`**: Upgrade priority → Oppgraderingsprioritet; Clusters → Klynger; Heatmap → Varmekart. Nytt: `HEATING_GRADE_NAMES`, `heatingGradeName()`.

**`components/Sidebar.jsx`**: Map tools → Kartverktøy; Toggle filters → Vis eller skjul filtre; Filters → Filtre; radius-tooltip/aria («Toggle radius search…») → «Slå søk i radius av eller på. Når det er på, klikker du i kartet for å søke etter bygg innenfor valgt radius.»; On/Off → På/Av; Switch to light/dark mode → Bytt til lyst/mørkt tema; Dark/Light mode → Mørkt/Lyst tema; Clear radius results → Fjern resultater fra radiussøk; Searching nearby buildings… → Søker etter bygg nær stedet du klikket på i kartet.

**`components/SearchBar.jsx`**: Search buildings → Søk etter bygg; placeholder «Search by adresse, poststed, or kommunenavn» → «Søk på adresse, poststed eller kommunenavn»; No building data loaded → Ingen byggdata er lastet inn; Clear search → Tøm søket; Search suggestions → Søkeforslag; Unknown address → Ukjent adresse; Location not registered → Sted ikke registrert; No matching buildings found → Fant ingen bygg som passer; No building data is available to search → Ingen byggdata er tilgjengelig å søke i.

**`App.jsx`**: Failed to load building data → Kunne ikke laste byggdata; Failed to search nearby buildings → Kunne ikke søke etter bygg i nærheten; No backend data loaded → Ingen data er lastet fra backend; No buildings match these filters → Ingen bygg passer med filtrene; Swagger-hint og «Adjust the ranges or grade filters…» → norsk; Loading building data / Preparing map, layers, and filters → Laster byggdata / Gjør klar kart, lag og filtre; Something went wrong → Noe gikk galt.

**`components/Filters.jsx`**: View mode → Visningsvalg (også aria-label); Bydel map display → Visning av bydeler i kartet; Stats → Statistikk; Filters → Filtre; Reset → Nullstill; Build year → Byggeår; Energy use → Beregnet energibehov (+ kWh/m²); Energy grade → Energikarakter; Heating grade → Oppvarmingskarakter; All → Alle; «maximum» → «maksimum» i aria-label; alle fire tooltips (energibehov, radius, energikarakter, oppvarmingskarakter) oversatt; karakterforklaringer (best…weakest → best, svært god, god, middels, svak, dårlig, svakest) og oppvarmingsforklaringer; statistikkpanelet (Database stats → Databasestatistikk; Buildings → Bygg; Avg energy → Gjennomsnittlig beregnet energibehov; Typical energy → Typisk beregnet energibehov (median); Common energy grade/heating → Vanligste energikarakter/oppvarmingskarakter; Avg build year → Gjennomsnittlig byggeår; Before 1980 → Før 1980; High upgrade → Høy oppgraderingsprioritet; Energy A–G → Energikarakter A–G; Heating green/yellow/orange/red → Oppvarming grønn/gul/oransje/rød; SSB / Oslo stats → Statistikk fra SSB / Oslo; Median price/income, Price per m2, Price trend, Population (growth) → Median pris/husholdningsinntekt, Pris per m², Pristrend, Folketall, Befolkningsvekst; NOBIL stats → Statistikk fra NOBIL; Public/Fast chargers → Offentlige ladere/Hurtigladere; External bydel stats are unavailable → Ekstern bydelsstatistikk er ikke tilgjengelig; loading → laster; N/A → Mangler). Oppvarmingsvalgene viser nå «grønn» osv. via `heatingGradeName()`.

**`components/MapView.jsx`**: alle `POPUP_HELP`-tekster; popup (Energy certificate → Energiattest; Grade → Karakter; Unit → Enhet; Energy use → Beregnet energibehov; Built → Byggeår; Certificate details → Detaljer om attesten; Address → Adresse; Municipality → Kommune; Organisation no. → Organisasjonsnr.; Certificate no. → Attestnummer; Issued → Utstedt; Heating grade → Oppvarmingskarakter (verdi som farge); Material → Materialvalg; Building summary → Oppsummering av bygget); oppgraderingspopup (Upgrade priority, Estimate confidence → Sikkerhet i anslaget, Total priority → Samlet prioritet, Energy/Heating upgrade need → Behov for energioppgradering / oppgradering av oppvarming, Main drivers → Viktigste faktorer, Recommended checks → Anbefalte kontroller, Data used → Data som er brukt, High/Medium/Low priority → Høy/Middels/Lav prioritet); nærhetspopup (Nearby result → Treff i nærheten; Coordinate # → Koordinat nr.; Lat/Lng → Breddegrad/lengdegrad; Building units → Antall enheter; Unit number → Enhetsnummer; Building units at location → Enheter på stedet; units → enheter; Unit X → Enhet X); Unknown address → Ukjent adresse (alle steder); N/A → Mangler; kWh/m2 → kWh/m²; legende (Information card → Infokort; Energy use per building location → Beregnet energibehov per byggested; lower/higher → lavere/høyere; Tile-mode building points → Byggpunkter i Enkel bygg; Colored by energy grade… → Farget etter energikarakter; Low/better condition, High/inspect first → Lav/bedre tilstand, Høy/undersøk først; Small/Medium/Large cluster → Liten klynge / enkeltbygg, Middels klynge, Stor klynge; «radios result» → Resultat fra søk i radius); Map view modes → Visningsvalg for kartet; kartpiller (Click the map to search within … → Klikk i kartet for å søke innenfor …; Finding nearby buildings… → Finner bygg i nærheten innenfor …; nearby loaded coordinates → innlastede koordinater i nærheten); MapLibre `locale` (Kart, Zoom inn, Zoom ut, Dra for å rotere kartet…, Lukk popup).

**`utils/upgradeInsights.js`**: alle drivere, anbefalinger, sikkerhetsnivå (High/Medium/Limited → Høy/Middels/Begrenset; «core inputs available» → «kjerneopplysninger tilgjengelig») og «Data som er brukt»-etiketter (Energikarakter, Oppvarmingskarakter, Beregnet energibehov, Byggeår, Energiattest, Ordning, Materialvalg, Enhet; Missing/Unknown/Not registered → Mangler/Ukjent/Ikke registrert). Importerer `heatingGradeName`.

**`utils/filtering.js`**: ordningsetiketter (All methods → Alle ordninger; 2026 method → Ny ordning (2026); Before 2026 → Gammel ordning (før 2026); Unknown date → Ukjent dato); `dataSource`-standard → «Lokale energiattestdata fra Enova»; `upgradePriority` → Høy/Middels/Lav prioritet.

**`services/api.js`**: «Request failed with status» → «Forespørselen feilet med status» (vises i feilvarselet).

Uendret: `ByggSide.jsx`, `ByggFraAttest.jsx`, `Router.jsx`, `main.jsx`, `store/`, `utils/geo.js`, `utils/osloBydeler.js` (bydelsnavn står som før), `dev/*.json`, `console.warn`-meldinger (utviklertekst).

## Testet
- `grep` etter engelske strenger, `aria-label=`, `title=`, `placeholder=`, `alt=` i `Frontend/src`: ingen engelsk brukertekst igjen. Bevisste unntak: MapLibre (navn), NOBIL, SSB, Enova, Swagger, kommentarer og `console.warn`.
- `npx vite build --outDir <temp>`: OK (8,6 s). `Frontend/dist` ikke rørt.
- `npm run dev` i Claudes nettleserpanel (backend av): sidepanel, filtre, statistikk (åpnet), visningsvalg (Bydeler i Oslo / Enkel bygg / Oppgraderingsprioritet), Klynger/Varmekart, legender, radius-pille og kartknapper kontrollert som norsk. Bygg-siden via `?eksempel=1#/bygg/80000000`: norsk. Ikke gjort: skjermbilde i mørkt tema.

## Usikkert
- **Kartpopupene** (energiattest-, oppgraderings- og nærhetspopup, enhetsliste) krever backend og er ikke sett i nettleseren; oversatt kun ved kodelesing. Bør sjekkes med backend.
- **Statistikkpanelet «Bygg»** (antall): koden teller kartpunkter, og jeg vet ikke om det er enheter eller attester (avhenger av «bare siste attest»). Oversatt til «Bygg»; eieren bør avgjøre om det skal stå «Antall enheter» eller «Antall attester» (faglig regel).
- «Oppgraderingsprioritet» på segmentknappen brytes over to linjer og er litt trang i smalt sidepanel (så også før med «Upgrade priority»).
- `Frontend/index.html` (utenfor mitt område) har `lang="en"` og engelsk `description`; bør endres til `nb`/norsk. Tittelen «Energimerking Dashboard» er uendret.
- Tall formateres med `toLocaleString()` uten `'nb-NO'` i `Filters.jsx`/`MapView.jsx` (kan gi komma/punktum etter nettleserens språk); det er logikk og ikke rørt.
- Tekster med fagtolkning, f.eks. «Behov for energioppgradering» og anbefalingene i `upgradeInsights.js`, er oversatt tett etter originalen uten nye påstander, men bør leses av eier.
- Bydelsnavn («Grunerlokka», «Ostensjo» …) er uten æøå i data; ikke rørt.

## Lær dette
**Hvorfor `aria-label` også må oversettes:** `aria-label`, `title` og `placeholder` vises ikke på skjermen, men skjermlesere leser dem opp som navnet på knapper og felt. Står de på engelsk, hører en norsk bruker av skjermleser en blanding, med engelsk uttale av norsk side, og kan ikke forstå hva knappen gjør. De teller også som «tekst brukeren møter» (WCAG-krav om språk), så en oversettelse som bare ser på synlig tekst er ufullstendig. Bruk derfor alltid søk på attributtene i tillegg til synlig tekst.

## Rettet etter reviewer
Eierens avgjørelser:
- **Telling (A):** teksten rettet, ikke logikken. Statistikkpanelet: «Bygg» → «Antall attester»; «Databasestatistikk» → «Statistikk for innlastede attester», med hjelpetekst «Tallene gjelder attestene som er lastet inn i kartet. En enhet kan ha flere attester.» Kartpopup: «Antall enheter» → «Antall attester», «Enheter på stedet» → «Attester på stedet», «N enheter» → «N attester». Legende: «Liten klynge / enkeltbygg» → «Liten klynge / enkeltattest»; «Byggpunkter i Enkel bygg» → «Attester i Enkel bygg» (fanenavnet «Enkel bygg» beholdt).
- **Fagord (B):** «beregnet energibehov» → «beregnet levert energi» overalt i `Frontend/src`, også `ByggSide.jsx`; enheten skrives alltid «kWh/m² per år» (filter, statistikk, popup, legende, bygg-side, oppgraderingsinnsikt). Tooltip uten dobbelt «beregnet». Bygg-siden: energikarakteren bygger på beregnet levert energi per m² per år, ikke målt forbruk.

Reviewers punkter: «Høy beregnet levert energi» (`upgradeInsights.js`); «Ny ordning (fra 2026)» og «Ukjent ordning» (`filtering.js`); «Attestår» i stedet for «Energiattest» foran årstall; popup «Karakter» → «Energikarakter»; «G er dårligst» i stedet for «svakest» (Filters, MapView); dato i filnavn rettet til 2026-11-16.

Notert, ikke endret: «Før 1980» i statistikkpanelet er en logikkgrense som ikke følger kohortene (før 1949, 1949–1969, 1970–1986 …). Bør avgjøres av eier. Test etter rettelsene: `vite build` OK; `npm run dev` med `?eksempel=1#/bygg/80000000` og sidepanelet kontrollert.
