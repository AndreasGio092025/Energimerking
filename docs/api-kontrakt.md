# API-kontrakt

Andre API-er: `api/bygg` (`CoordinateController`) og `api/bydel-stats` (`BydelStatsController`). `/tiles` står under.

Endrer du et felt: oppdater denne filen først, og skriv det i rapporten din.

## Bygg-oversikt (`api/bygg-oversikt`)
Status: godkjent av eieren 2026-11-15.

Ruter (`ByggOversiktController`), begge returnerer rå JSON fra SQL-funksjoner i
`Backend/Docker/db-init/07_bygg_oversikt.sql`:

- `GET api/bygg-oversikt/fra-attest/{attestnummer}` -> `bygg_fra_attest(attestnummer)`
- `GET api/bygg-oversikt/{bygningsnummer}` -> `bygg_oversikt_json(bygningsnummer)`

Ukjent attestnummer eller bygningsnummer gir HTTP 404. Grunnlaget er `mv_siste_attest_per_enhet`
(siste attest per enhet og ordning) og `byggeaar_kohort()`, etter reglene i `CLAUDE.md`.

**Personvern:** API-et gir aldri bruksenhetsnummer, attestnummer eller `enhet_id`. Tallene er summer eller
medianer over enhetene i bygget. Har bygget bare én eller to enheter (de fleste småhus), er tallene i praksis
den ene boligens karakter og beregnede leverte energi. Det er bevisst (eieren 2026-11-16): energiattestene er
offentlige hos Enova og vises allerede per attest i kartet. `andel_enheter_bedre_enn_lignende` vises likevel
bare fra 3 enheter, fordi den beskriver spredning i bygget.

**Energitall** (`median_kwh_m2` og andelene) er *beregnet* levert energi fra attesten, ikke målt forbruk.
Grensesnittet skal si «beregnet levert energi» (kWh/m² per år), ikke «energibehov», «bruker» eller «forbruk».

### `fra-attest`
| Felt | Type | Enhet | Betydning |
|------|------|-------|-----------|
| `bygningsnummer` | tekst | – | Bygget attesten hører til. |

### Bygg-oversikt: toppnivå
| Felt | Type | Enhet | Betydning |
|------|------|-------|-----------|
| `bygningsnummer` | tekst | – | Byggets nasjonale id. |
| `adresser` | liste av tekst | – | Alle adresser (innganger) i bygget, sortert. |
| `bygningskategori` | tekst eller null | – | F.eks. "Boligblokker", "Småhus". Fra siste attest. |
| `byggeaar` | heltall eller null | år | Byggeår. Null hvis ukjent (0 eller før 1800). |
| `kohort` | tekst eller null | – | Byggeårsgruppe fra `byggeaar_kohort()`, f.eks. "1949–1969". Null hvis byggeår er ukjent. |
| `minimum_lignende` | heltall | enheter | Minste antall lignende enheter før sammenligning vises (10). |
| `ordninger` | liste | – | Én rad per ordning bygget har attester i: først "gammel", så "ny". Tom liste hvis ingen. |

### Bygg-oversikt: hver rad i `ordninger`
Ordningene blandes aldri; hver rad gjelder bare attester i den ordningen.

| Felt | Type | Enhet | Betydning |
|------|------|-------|-----------|
| `ordning` | tekst | – | "gammel" (utstedt før 2026-01-01) eller "ny". |
| `periode` | tekst | – | Klar tekst for grunnlaget, f.eks. "attester utstedt i 2025" eller "attester utstedt i 2026". Vises i grensesnittet. |
| `antall_enheter` | heltall | enheter | Enheter i bygget med siste attest i denne ordningen. |
| `antall_attester` | heltall | attester | Alle attester i bygget i denne ordningen (kan være flere enn enheter). |
| `karakterfordeling` | objekt | enheter | Antall enheter per energikarakter: `{"A": 0, "B": 3, ..., "G": 1}`. Alle sju nøkler er med. |
| `median_kwh_m2` | desimaltall eller null | kWh/m² per år | Median beregnet levert energi over enhetene, rundet til én desimal. |
| `oppvarmingsfordeling` | objekt eller null | enheter | Antall enheter per oppvarmingskarakter (`Green`, `LightGreen`, `Yellow`, `Orange`, `Red`). Null for ny ordning, som ikke har oppvarmingskarakter. |
| `lignende` | objekt | – | Sammenligning med lignende bygg, se under. |

### `lignende` (inne i hver ordning)
"Lignende" = enheter i *andre* bygg i samme ordning, valgt i to trinn (se `CLAUDE.md`):
1. samme `bygningskategori` og `kohort`;
2. har trinn 1 under `minimum_lignende` enheter, eller bygget mangler kohort: samme `bygningskategori`, uansett byggeår.

| Felt | Type | Enhet | Betydning |
|------|------|-------|-----------|
| `grunnlag` | tekst eller null | – | `"kategori og byggeår"` (trinn 1), `"bare kategori"` (trinn 2), eller null hvis byggets kategori er ukjent. Grensesnittet skal si hva bygget sammenlignes med. |
| `antall_enheter` | heltall | enheter | Enheter i grunnlaget som ble brukt. 0 hvis byggets kategori er ukjent. |
| `antall_bygg` | heltall | bygg | Antall lignende bygg. |
| `nok_data` | sann/usann | – | `true` hvis `antall_enheter` ≥ `minimum_lignende`. Er den `false`, er feltene under null, og grensesnittet skal si at det er for få lignende bygg. |
| `karakterfordeling` | objekt eller null | andel 0–1 | Andel av lignende enheter per energikarakter, A–G. Summerer til 1. |
| `median_kwh_m2` | desimaltall eller null | kWh/m² per år | Median for lignende enheter, rundet til én desimal. |
| `andel_med_hoyere_energibruk` | desimaltall eller null | andel 0–1 | Andel av lignende enheter med høyere beregnet levert energi per m² enn byggets median. 0,7 betyr at bygget har lavere beregnet levert energi enn 70 % av lignende enheter. |
| `andel_enheter_bedre_enn_lignende` | desimaltall eller null | andel 0–1 | Andel av *byggets* enheter med lavere beregnet levert energi per m² enn `median_kwh_m2` for lignende. Viser spredning i bygget ("6 av 10 enheter har lavere beregnet levert energi enn vanlig"). Null hvis bygget har under 3 enheter i ordningen, eller hvis `nok_data` er `false`. |
| `antall_enheter_bedre_enn_lignende` | heltall eller null | enheter | Antall av byggets enheter (med energitall) som har lavere beregnet levert energi enn `median_kwh_m2` for lignende. Null i de samme tilfellene som andelen over. Frontend viser "X av N enheter" med dette tallet, så ingenting regnes ut i nettleseren. |
| `antall_enheter_med_energitall` | heltall eller null | enheter | N i "X av N": byggets enheter i ordningen som har beregnet levert energi. Null når feltet over er null. |

Frontend skal vise byggets `karakterfordeling` (antall enheter per karakter) synlig sammen med medianen, så spredningen i bygget ikke skjules.

## Vektor-tiles for «Enkel bygg», per enhet og per bygg (`GET /tiles/{z}/{x}/{y}.pbf`)
Status: godkjent av eieren 2026-11-17. Erstatter den gamle tile-kontrakten (under) når den er levert.

Kilde: ny SQL-funksjon i `Backend/Docker/db-init/` bygget på `mv_enhet_punkt` (siste attest per enhet og ordning,
samme kartpunkt som `api/enheter`). Den gamle `custom_ST_GetPoints` og attest-tilene fjernes.

Query-parametre (samme rute som før):

| Parameter | Type | Betydning |
|-----------|------|-----------|
| `visning` | tekst | `enheter` (standard) eller `bygg`. |
| `ordning` | tekst | `gammel` (standard) eller `ny`. Ingen `alle`: ordningene blandes aldri i samme kart. |

- Format: Mapbox Vector Tile (`application/vnd.mapbox-vector-tile`). Ett lag per svar, med samme navn som `visning`: `enheter` eller `bygg`.
- Zoom: tom tile (HTTP 204) under zoom 10. Ugyldig `z/x/y`, `visning` eller `ordning` gir HTTP 400 med norsk tekst.
- Tak: maks 8000 punkter per tile (5000 under zoom 13), som før.
- **Personvern:** ingen attestnummer, bruksenhetsnummer eller `enhet_id`, verken her eller i popup.

### Lag `enheter`: ett punkt per enhet med siste attest i valgt ordning
| Felt | Type | Enhet | Betydning |
|------|------|-------|-----------|
| `id` | tekst | – | Samme ikke-personlige nøkkel (hash) som i `api/enheter/punkter`. |
| `ordning` | tekst | – | "gammel" eller "ny". |
| `bygningsnummer` | tekst | – | Brukes til «Vis bygget». |
| `adresse` | tekst | – | Enhetens adresse. |
| `bygningskategori` | tekst eller null | – | F.eks. "Boligblokker". |
| `byggeaar` | heltall eller null | år | Null hvis ukjent (0 eller før 1800). |
| `kohort` | tekst eller null | – | Fra `byggeaar_kohort()`. Null hvis byggeår er ukjent. |
| `energikarakter` | tekst | A–G | Siste attests energikarakter. |
| `oppvarmingskarakter` | tekst eller null | farge | `Green`, `LightGreen`, `Yellow`, `Orange`, `Red`. Null for ny ordning. |
| `energi_kwh_m2` | desimaltall eller null | kWh/m² per år | Beregnet levert energi, én desimal. |
| `utstedelsesdato` | tekst (ÅÅÅÅ-MM-DD) | – | Siste attests dato. |
| `antall_enheter_samme_punkt` | heltall | enheter | Enheter i samme ordning på identisk koordinat. |

### Lag `bygg`: ett punkt per bygning, over byggets enheter i valgt ordning
Punktet er midtpunktet av byggets enhetspunkter. Bygg uten enheter i ordningen er ikke med.

| Felt | Type | Enhet | Betydning |
|------|------|-------|-----------|
| `bygningsnummer` | tekst | – | Byggets id; klikk åpner bygg-siden. |
| `ordning` | tekst | – | "gammel" eller "ny". |
| `adresse` | tekst | – | Første adresse alfabetisk. |
| `antall_adresser` | heltall | – | Antall adresser (innganger) i bygget, så frontend kan skrive «og N andre». |
| `antall_enheter` | heltall | enheter | Enheter i bygget med siste attest i ordningen. |
| `median_karakter` | tekst | A–G | Midterste energikarakter når enhetene sorteres A→G; ved partall antall den dårligste av de to midterste. |
| `median_kwh_m2` | desimaltall eller null | kWh/m² per år | Median beregnet levert energi over enhetene, én desimal. |
| `bygningskategori` | tekst eller null | – | Fra siste attest, som i bygg-oversikten. |
| `byggeaar` | heltall eller null | år | Null hvis ukjent. |
| `kohort` | tekst eller null | – | Fra `byggeaar_kohort()`. |

Frontend viser `antall_enheter` i popup («Median for N enheter»), så det er tydelig at tallet gjelder enheter og ikke én attest.

## Vektor-tiles, gammel versjon (`GET /tiles/{z}/{x}/{y}.pbf`)
Status: godkjent av eieren 2026-11-15. **Erstattes** av kontrakten over.

Kilde: `custom_ST_GetPoints(z, x, y)` i `Backend/Docker/db-init/03_tile_functions.sql`,
som leser `denorm_matrikkel_og_enova_oslo` (Oslo, attester fra 2025).

- Format: Mapbox Vector Tile (`application/vnd.mapbox-vector-tile`), ett lag: `points` (punkter).
- Zoom: tom tile (HTTP 204) under zoom 10. Ugyldig `z/x/y` gir HTTP 400.
- Tak: maks 5000 punkter per tile under zoom 13, ellers 8000. Punkter over taket faller bort (sortert på `id`).
- Én rad per attest, ikke per enhet (se "Enheter vs attester" i `CLAUDE.md`).

| Felt | Type | Enhet | Betydning |
|------|------|-------|-----------|
| `id` | heltall | – | Radens id i `denorm_matrikkel_og_enova_oslo`. Brukes til `GET api/bygg/GetTilePointDetails?id=` for popup. |
| `adresse` | tekst | – | Gateadresse fra matrikkelen. |
| `attestNr` | tekst | – | Attestnummer fra Enova. |
| `materialvalg` | tekst | – | Hovedmateriale i bygget (f.eks. "Tre"). Kan mangle. |
| `byggeaar` | heltall | år | Byggeår. 0 og år før 1800 betyr ukjent. |
| `gard` | heltall | – | Gårdsnummer i matrikkelen. |
| `bruksenhetsNr` | tekst | – | Bruksenhetsnummer (f.eks. "H0101"). Kan mangle. |
| `energikarakter` | tekst | A–G | Energikarakter på attesten. |
| `oppvarmingskarakter` | tekst | farge | `Green`, `Lightgreen`, `Yellow`, `Orange` eller `Red`. Merk stavemåten `Lightgreen`. |
| `energy` | desimaltall | kWh/m² per år | Beregnet levert energi totalt per kvadratmeter. |

## Enheter i kartet (`api/enheter`)
Status: godkjent av eieren 2026-11-17.

Erstatter `GetNearbyDeNormGeoJson` i bydelsvisningen (kart og statistikkpanel). «Enkel bygg» (`/tiles`) og bygg-siden
er urørt. Ruter i `EnheterController`; begge returnerer rå JSON fra SQL-funksjoner i
`Backend/Docker/db-init/08_enheter_kart.sql`, bygget på `mv_siste_attest_per_enhet` (siste attest per enhet og ordning).

Felles parametre (query):

| Parameter | Type | Betydning |
|-----------|------|-----------|
| `lat`, `lon` | desimaltall | Midtpunkt (WGS84). |
| `radius` | heltall, meter | 1–20 000. Området er en sirkel, ikke en ekte bydelsgrense. |
| `ordning` | tekst | Bare for `punkter`: `gammel`, `ny` eller `alle` (standard `gammel`). |

Ugyldige parametre gir HTTP 400. Ingen bruksenhetsnummer, attestnummer eller `enhet_id` i utdata.

### `GET api/enheter/punkter`
GeoJSON `FeatureCollection` med ett `Point` per enhet (siste attest i ordningen) som har kartpunkt. Ved `ordning=alle`
kan samme enhet gi to punkter, ett per ordning; `ordning` i egenskapene skiller dem. Maks 50 000 punkter; feltet
`avkortet` sier om taket ble nådd.

Toppnivå: `type` ("FeatureCollection"), `features`, `avkortet` (sann/usann), `antall` (heltall, antall punkter).

| Egenskap per punkt | Type | Enhet | Betydning |
|--------------------|------|-------|-----------|
| `id` | tekst | – | Stabil, ikke-personlig nøkkel for punktet (hash), brukes bare til React/kart. |
| `ordning` | tekst | – | "gammel" eller "ny". |
| `bygningsnummer` | tekst | – | Byggets nasjonale id (brukes til «Vis bygget»). |
| `adresse` | tekst | – | Adressen til enheten. |
| `bygningskategori` | tekst eller null | – | F.eks. "Boligblokker". |
| `byggeaar` | heltall eller null | år | Null hvis ukjent (0 eller før 1800). |
| `kohort` | tekst eller null | – | Fra `byggeaar_kohort()`. |
| `energikarakter` | tekst | A–G | Siste attests energikarakter. |
| `oppvarmingskarakter` | tekst eller null | farge | Som oppslagstabellen (`LightGreen`). Null for ny ordning. |
| `energi_kwh_m2` | desimaltall eller null | kWh/m² per år | Beregnet levert energi, én desimal. |
| `utstedelsesdato` | dato (ÅÅÅÅ-MM-DD) | – | Siste attests dato. |
| `antall_enheter_samme_punkt` | heltall | enheter | Enheter i samme ordning med identisk koordinat (f.eks. en blokk), så frontend kan vise «N enheter her». |

### `GET api/enheter/statistikk`
Regnet i SQL over *alle* enheter i sirkelen, ikke bare de som vises.

Toppnivå:

| Felt | Type | Enhet | Betydning |
|------|------|-------|-----------|
| `omrade` | objekt | – | `{ "lat", "lon", "radius_m" }` som brukt. |
| `ordninger` | liste | – | Én rad per ordning, "gammel" før "ny". Ordningene blandes aldri. |

Hver rad i `ordninger`:

| Felt | Type | Enhet | Betydning |
|------|------|-------|-----------|
| `ordning` | tekst | – | "gammel" eller "ny". |
| `periode` | tekst | – | F.eks. "attester utstedt i 2025". |
| `antall_enheter` | heltall | enheter | Enheter med kartpunkt i sirkelen. |
| `antall_attester` | heltall | attester | Alle attester for disse enhetene i ordningen. |
| `antall_bygg` | heltall | bygg | Distinkte bygningsnumre. |
| `enheter_uten_kartpunkt` | heltall | enheter | Enheter i ordningen i hele Oslo som ikke har koordinat og derfor ikke kan telles i noe område. Samme tall uansett sirkel. |
| `karakterfordeling` | objekt | enheter | Antall enheter per energikarakter, alle sju nøkler A–G. |
| `oppvarmingsfordeling` | objekt eller null | enheter | Antall per oppvarmingskarakter; null for ny ordning. |
| `median_kwh_m2` | desimaltall eller null | kWh/m² per år | Median beregnet levert energi over enhetene. |
| `gjennomsnitt_kwh_m2` | desimaltall eller null | kWh/m² per år | Gjennomsnitt, én desimal. |
| `gjennomsnitt_byggeaar` | heltall eller null | år | Over enheter med gyldig byggeår. |
| `kohortfordeling` | objekt | enheter | Antall enheter per kohort fra `byggeaar_kohort()`, pluss nøkkelen `"ukjent"`. Erstatter «Før 1980». |

Har en ordning 0 enheter i sirkelen, er den med med `antall_enheter: 0` og null-tall.
