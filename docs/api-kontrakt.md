# API-kontrakt

Ruter (`api/bygg-oversikt`), alle returnerer rå JSON fra SQL-funksjoner:

> Planlagt: disse rutene og SQL-funksjonene finnes ikke i koden ennå (per 2026-11-14).
> Dagens API er `api/bygg` (`CoordinateController`) og `api/bydel-stats` (`BydelStatsController`).

- `GET fra-attest/{attestnummer}` -> `bygg_fra_attest(attestnummer)` (bygningsnummer)
- `GET {bygningsnummer}`          -> `bygg_oversikt_json(bygningsnummer)`

Endrer du et felt: oppdater denne filen først, og skriv det i rapporten din.

## Felter
TODO (sql-agent): list JSON-feltene fra `Backend/Docker/db-init/03_bygg_oversikt.sql` her,
med navn, type, enhet og én setning om hva feltet betyr. Frontend skal kunne bygge
mot denne listen uten å lese SQL. Eieren godkjenner listen før frontend-arbeid starter.

| Felt | Type | Enhet | Betydning |
|------|------|-------|-----------|

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
