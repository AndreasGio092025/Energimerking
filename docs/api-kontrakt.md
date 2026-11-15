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
