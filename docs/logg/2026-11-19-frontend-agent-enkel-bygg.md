# 2026-11-19 frontend-agent: «Enkel bygg» per enhet og per bygg

**Hva:** «Enkel bygg» henter nå vektor-tiles med `visning` (enheter/bygg) og `ordning` (gammel/ny) etter kontrakten, og brukeren velger begge i sidepanelet. Popup og farger bruker feltene i kontrakten, og oppgraderingsprioritet bruker `kohort` fra API-et.

**Hvorfor:**
- Egen kilde og eget lag per valg (kilden har valget i adressen), og det gamle laget fjernes ved bytte. Dermed blandes gammel og ny ordning aldri.
- Popup per enhet: «N enheter her», ordning, byggeårsgruppe, attestdato. Popup per bygg: «Median energikarakter X for N enheter», «Antall enheter», «og N andre adresser». Tallene kommer ferdig fra tilene; nettleseren regner ingenting. Klikk henter ikke lenger noe fra API-et (`fetchTilePointDetails` og `fetchBuildingsBoundsGeoJson` er fjernet, den gamle tile-kontrakten erstattes).
- Filtre (`utils/tileFilter.js`) bygges om til MapLibre-filter på feltene tilene har (`median_karakter`/`median_kwh_m2` per bygg). Oppvarmingskarakter vises som filter bare for enheter i gammel ordning, siden den er tom ellers. Filter på standardverdi tas ikke med, så punkter uten byggeår ikke forsvinner.
- `upgradeInsights.js`: byggeårsvurderingen bruker `kohort` (grupper: høy for før 1949 til 1986, middels for 1987–2006, lav for 2007 og senere). Ingen årstall i nettleseren. Uten kohort regnes byggeår som manglende, i tråd med kohortregelen. Forkastet: å beholde egne grenser (`< 1987`, `< 2010`).
- Testdata: `dev/tiles-eksempel.js` lager ekte MVT-tiles i nettleseren fra eksempelenhetene (bare med `?eksempel=enheter`).

**Testet:**
- `npm run build` grønt. Ingen lint-skript finnes i `package.json`. Playwright finnes ikke i prosjektet, så jeg brukte den innebygde nettleseren mot `?eksempel=enheter` på dev-server.
- Per enhet og per bygg, gammel og ny ordning: pinner skifter riktig. Popup per bygg viser median E for 1 enhet, 306,4 kWh/m² per år, «Vis bygget». Mobilbredde (375 px): sidepanelet bryter riktig.
- Skjermbilder tatt i nettleserøkta (ikke lagret i repoet).
- IKKE testet: ekte tiles fra backend (SQL-funksjonen er ikke ferdig), og utskrift. Bygg-siden er ikke endret.

**Usikkert:**
- `api/enheter/punkter` leverer `kohort` etter kontrakten; er den null, regnes byggeår som manglende i oppgraderingsprioritet. Bør sjekkes mot ekte data.
- Poenggrensene per kohort (hvilke grupper som er høy/middels/lav) er min tolkning av de gamle årsgrensene. Eieren bør bekrefte; særlig 1997–2006 (middels) og 2007–2016 (lav).
- Gammel kode tok med `Lightgreen`-stavemåten fra gammel tile-kontrakt; ny kontrakt bruker `LightGreen`. Filtrene bruker `LightGreen`.
- MIN_TILE_ZOOM er fortsatt 14 (satt etter gammel måling av 8000-taket); kontrakten sier tom tile under zoom 10 og tak 5000 under zoom 13. Bør kanskje måles på nytt med enhetstiles.
- Tilene har ikke `energi_kwh_m2` for alle; filter på beregnet levert energi slipper gjennom punkter uten verdi.

**Lær dette:** Vektor-tiles deler kartet i ruter og sender bare punktene som trengs, kodet binært. Kartbiblioteket leser feltene (`energikarakter`, `median_karakter`) direkte, så fargen og filteret kan settes uten at nettleseren henter eller regner ut noe selv.
