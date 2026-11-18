# 2026-11-17 frontend-agent: små rettinger

**Hva:** Tre rettinger i `Frontend/src/`: eksempeldata for enheter har ferdige kohort-tekster (ingen årsgrenser i nettleseren), tekster i radiussøket sier «enheter», og filterteksten i Oppgraderingsprioritet nevner ikke statistikken og sier at kartet viser gammel ordning.

**Hvorfor:**
- `kohortFor()` i `dev/enheter-eksempel.js` er fjernet. Hver eksempelrad trekker nå én av de ferdige kohort-tekstene (`null` uten byggeår), slik API-et leverer `kohort`. Forkastet: å kopiere grensene til en tabell i JS (samme brudd på regelen).
- Søket gir enheter, så teksten sier enheter. Retting i `Sidebar.jsx` (varselteksten og aria-label/title på radiusknappen), `MapView.jsx` (lastepillen) og `Filters.jsx` (hjelpetekst for Radius).
- `Filters.jsx`: i Oppgraderingsprioritet er filternotatet nå «Filtrene gjelder punktene i kartet. Kartet viser gammel ordning (før 2026) i denne visningen.» Ordningsnavnet kommer fra `ordningLabel('gammel')`. Ingen logikk for hvilke data som vises er endret. I vanlig kartvisning er teksten som før.

**Før/etter**
- «Søker etter bygg nær stedet du klikket på i kartet.» -> «Søker etter enheter nær stedet du klikket på i kartet.»
- «… søke etter bygg innenfor valgt radius.» -> «… søke etter enheter innenfor valgt radius.»
- «Finner bygg i nærheten innenfor N m …» -> «Finner enheter i nærheten innenfor N m …»
- Radius-hjelpetekst: «søker etter bygg i nærheten» -> «søker etter enheter i nærheten»
- Filternotat i Oppgraderingsprioritet: «… De endrer ikke tallene i statistikken.» -> «… Kartet viser gammel ordning (før 2026) i denne visningen.»

**Treff på kohortgrenser (1949, 1969, 1986, 1996, 2006, 2016, 2017) i `Frontend/src`:**
- `dev/enheter-eksempel.js`: `kohortFor` (fjernet); `KOHORTER` med ferdige tekster beholdt.
- `dev/bygg-oversikt-eksempel*.json` (4 filer): bare ferdige `kohort`-tekster som data, ingen logikk.
- Ingen andre treff. Ingen annen kode i src regner kohort fra byggeår. *(Rettet av hovedsesjonen etter reviewer: søket tok ikke med nedre grenser som 1970, 1987, 1997, 2007. `utils/upgradeInsights.js` har egne poenggrenser `< 1987` og `< 2010` for Oppgraderingsprioritet. Det er ikke «lignende bygg», men står som åpent punkt i CLAUDE.md.)* `enheter-eksempel.js` brukes bare fra `services/api.js` (dynamisk import) ved `?eksempel=enheter`.

**Testet:**
- `npm run build` uten feil (bare vanlig advarsel om store filer). `dist/` er sporet i git og ble endret av bygget; det er tilbakestilt og ikke committet.
- Backend på 5289 og vite på 5175, ekte API (`/api/enheter/statistikk` ga 200). Stoppet etterpå; eierens server på 5277 var urørt.
- I nettleseren: Oppgraderingsprioritet viser nytt filternotat og pillen «Viser Gammel ordning (før 2026)»; vanlig visning viser det gamle notatet om statistikken (slik det skal).

**Usikkert:**
- «Søker etter enheter …» og «Finner enheter i nærheten …» er bare verifisert i kildekode og bygg, ikke sett i nettleseren: kartklikket startet ikke radiussøk i den automatiske testen (radius på, klikk i kartet). Bør klikkes manuelt. *(Senere gjort av hovedsesjonen: radiussøket viste «Søker etter enheter nær stedet …», «Finner enheter i nærheten innenfor 5 000 m …» og «200 enheter i nærheten (maks 200)».)*
- Kohort i eksempeldata trekkes uavhengig av byggeår, så en rad kan ha f.eks. byggeår 2020 og kohort «før 1949». Gjelder bare testdata bak `?eksempel=enheter`.
- «Fant ingen bygg som passer» i `SearchBar.jsx` gjelder adressesøk (bygg), ikke radiussøk, og er ikke endret.
- Skjermbilde med Playwright ble ikke tatt; brukte nettleserpanelet i stedet.

**Lær dette:** Én sannhetskilde. Kohortgrensene bor i SQL (`byggeaar_kohort()`); frontend viser bare teksten API-et leverer. Da kan grensene endres ett sted uten at nettleseren kommer ut av takt.
