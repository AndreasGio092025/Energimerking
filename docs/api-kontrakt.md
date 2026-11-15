# API-kontrakt

Andre API-er: `api/bygg` (`CoordinateController`), `api/bydel-stats` (`BydelStatsController`) og `/tiles` (under).

Endrer du et felt: oppdater denne filen først, og skriv det i rapporten din.

## Bygg-oversikt (`api/bygg-oversikt`)
Status: til godkjenning (2026-11-15).

Ruter (`ByggOversiktController`), begge returnerer rå JSON fra SQL-funksjoner i
`Backend/Docker/db-init/07_bygg_oversikt.sql`:

- `GET api/bygg-oversikt/fra-attest/{attestnummer}` -> `bygg_fra_attest(attestnummer)`
- `GET api/bygg-oversikt/{bygningsnummer}` -> `bygg_oversikt_json(bygningsnummer)`

Ukjent attestnummer eller bygningsnummer gir HTTP 404. Grunnlaget er `mv_siste_attest_per_enhet`
(siste attest per enhet og ordning) og `byggeaar_kohort()`, etter reglene i `CLAUDE.md`.

**Personvern:** API-et gir aldri bruksenhetsnummer, attestnummer, `enhet_id` eller tall for én enkelt
enhet. Alle tall er summer eller medianer over enheter.

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
"Lignende" = enheter i *andre* bygg med samme `bygningskategori` og `kohort`, i samme ordning.

| Felt | Type | Enhet | Betydning |
|------|------|-------|-----------|
| `antall_enheter` | heltall | enheter | Enheter i lignende bygg. 0 hvis byggets kategori eller kohort er ukjent. |
| `antall_bygg` | heltall | bygg | Antall lignende bygg. |
| `nok_data` | sann/usann | – | `true` hvis `antall_enheter` ≥ `minimum_lignende`. Er den `false`, er feltene under null, og grensesnittet skal si at det er for få lignende bygg. |
| `karakterfordeling` | objekt eller null | andel 0–1 | Andel av lignende enheter per energikarakter, A–G. Summerer til 1. |
| `median_kwh_m2` | desimaltall eller null | kWh/m² per år | Median for lignende enheter, rundet til én desimal. |
| `andel_med_hoyere_energibruk` | desimaltall eller null | andel 0–1 | Andel av lignende enheter som bruker mer energi per m² enn byggets median. 0,7 betyr at bygget bruker mindre enn 70 % av lignende. |

## Vektor-tiles (`GET /tiles/{z}/{x}/{y}.pbf`)
Status: godkjent av eieren 2026-11-15.

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
