# 2026-11-17 sql-agent: database fra repo + dumpfil

## Hva
Hele databasen kan nå bygges fra repoet og én lokal dumpfil (`Backend/Docker/Data/grunndata.dump`): `db-init/` har fått utvidelser, sekvens, gjenoppretting av de 12 grunntabellene og `mv_bygg_med_koordinater`, og den gamle `Energimerking.sql` er flyttet til `docs/gammel-skjema.sql`. Bevist i en midlertidig container (`energimerke-test`, port 5433): samme tall som live-databasen på alle sammenligninger.

## Nye og endrede filer
- `Backend/Docker/db-init/00_extensions.sql`: `postgis` og `pg_trgm`.
- `Backend/Docker/db-init/00_sekvens.sql`: lager sekvensen `eiendom_id_seq`.
- `Backend/Docker/db-init/01_gjenopprett.sh`: `pg_restore`, setter sekvensverdi, `ANALYZE`. Mangler dumpen, skrives en norsk feilmelding og init avbrytes med feil.
- `Backend/Docker/db-init/09_bygg_med_koordinater.sql`: `mv_bygg_med_koordinater` + 6 indekser (definisjon fra live via `pg_get_viewdef`).
- `Backend/Docker/db-init/05_siste_attest_per_enhet.sql`: kun kommentar rettet (sann rekkefølge).
- `docs/gammel-skjema.sql` (git mv fra `db-init/Energimerking.sql`, historisk-kommentar øverst).
- `.gitattributes`: `*.sh text eol=lf`.
- Ingen `99_refresh.sql`: alle MV-er i 05, 07, 08 og 09 lages `WITH DATA` (standard for `CREATE MATERIALIZED VIEW`) og er fylt rett etter oppbygging. Verifisert: radantallene under stemmer uten refresh.

Avvik fra oppdraget: utvidelsene heter `00_extensions.sql` (ikke 01), slik at `00_sekvens.sql` og `01_gjenopprett.sh` kan komme i riktig rekkefølge uten å være avhengig av alfabetisk sortering av `01_e...` mot `01_g...`.

## Hvorfor
- **Bare `postgis` og `pg_trgm`.** Live har også `postgis_topology`, `postgis_tiger_geocoder` og `fuzzystrmatch`, men de kommer bare fra imagets `10_postgis.sh`. Ingen tabell, view, funksjon, indeks eller C#-kode bruker dem (grep etter levenshtein/soundex/topology/tiger: ingen treff). `pg_trgm` trengs fordi dumpen har indeksen `idx_coordinates_adresse_trgm` (`gin_trgm_ops`). Imagets `10_postgis.sh` kjører IKKE: bind-mounten erstatter hele `/docker-entrypoint-initdb.d`, så vi lager utvidelsene selv.
- **Sekvensen `eiendom_id_seq` (funn).** Første testkjøring feilet: `bygning."bygningID"` har `DEFAULT nextval('public.eiendom_id_seq')`, men sekvensen eies ikke av noen kolonne og ble derfor ikke med i dumpen. Løsning: lag den før restore (00_sekvens), sett verdien til `max("bygningID")` etter restore. Alternativ forkastet: lage ny dump (utenfor oppdraget).
- **`--exit-on-error`** i `pg_restore`: en halvt gjenopprettet database som ser ok ut er verre enn en som ikke starter.
- **`ANALYZE` etter restore (funn).** Uten statistikk brukte `08_enheter_kart.sql` 6 min 17 s (hele init 7 min 12 s). Med `ANALYZE` 41 s (hele init 1 min 49 s).
- **Hva WebApi/tiles faktisk bruker** (grep i `Backend/`): base-tabellene (EF: `Coordinates`, `Eiendoms`, `DenormMatrikkelOgEnovaOslos`), funksjonene `custom_ST_GetPoints`, `bygg_oversikt_json`, `bygg_fra_attest`, `enheter_punkter_json`, `enheter_statistikk_json` (alle fra 03/07/08), og `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_bygg_med_koordinater` i `POST api/bygg/refresh` (ble dekket av ingenting før; derfor 09).
- **Finnes live, men tas IKKE med (ingen bruker):** `mv_energimerke`, `mve_energimerke`, `v_bygg_med_koordinater`, `v_energimerke_oslo`, `mv_leilighet_siste_energimerke` (view), sekvensen `bygning_eiendomid_seq`, `spatial_ref_sys`/topology/tiger-objekter (kommer med utvidelsene), triggeren `layer_integrity_checks` (topology). EF-modellen har `DbSet`er for dem, men de brukes kun i kommentert kode (`CoordinateController` linje 56 og 199). Hentes de frem igjen, må definisjonene legges til (`pg_get_viewdef` fra live).
- Objektlister (tabeller, funksjoner, indekser) er ellers identiske i live og testbasen (diff over `pg_class`/`pg_proc`/`pg_indexes`): de eneste forskjellene er objektene i listen over.

## Testet
Midlertidig container fra `postgis/postgis` (PostgreSQL 17.5, samme image som live), port `127.0.0.1:5433`, eget volum, `db-init` montert `:ro`, `Data` som `/import`. Fjernet container og volum etterpå (live-containeren og `dockerenergimerke_*` ikke rørt, bare lest).

**Init-tid, siste kjøring (med ANALYZE):** 1 min 49 s totalt, ingen feil i loggen. Fordeling: restore 45 s (inkl. ANALYZE), 05 3 s, 07 7 s, 08 41 s, 09 9 s.
Første kjøring uten ANALYZE: 7 min 12 s (08: 6 min 17 s). Kjøring 0 feilet på `eiendom_id_seq` (se over).

**Sammenligning live (5432) mot test (5433)**, identisk i begge (utdata fra samme skript, md5 lik):
- `mv_siste_attest_per_enhet`: 108 107 gammel / 13 429 ny.
- `enheter_statistikk_json(59.9056, 10.7867, 2300)`, gammel ordning: 21 151 enheter, 25 016 attester, 1 900 bygg (median 161,5; snitt 184,4; 52 uten kartpunkt). Ny ordning: 2 271 enheter, 4 040 attester, 920 bygg.
- Radantall: bygning 97 364; coordinates 106 014; coordinates_raw 106 014; denorm_matrikkel_og_enova_oslo 126 363; eiendom 276 680; eiendom_bygning 186 751; energiattester 83 975; energikarakter 7; energimerke 125 973; enova_raw 276 680; kommune 384; oppvarmingskarakter 5. Views: v_attester 144 081; mv_siste_attest 121 536; mv_enhet_punkt 121 536; mv_lignende_enheter 243 058; mv_lignende_fordeling 175; mv_attester_per_bygg 21 112; mv_bygg_med_koordinater 125 973.
- Tre stikkprøver `bygg_oversikt_json` (byggene 80206887, 80864213, 80881681, valgt tilfeldig blant bygg med 5-40 enheter): JSON byte-for-byte lik (md5 lik). Eks. 80206887: Selvbyggerveien 84/86, boligblokker, 1958, 14 enheter og 15 attester i gammel ordning, kohort 1949-1969. Punkt-id-er (saltet) er ulike mellom databasene, som forventet, men de inngår ikke i disse funksjonene.
- Vektortile `custom_ST_GetPoints(14, 8682, 4766)`: 233 444 byte, md5 lik.
- WebApi (`ConnectionStrings__Postgres` med `Port=5433`, port 5290): `GET /tiles/14/8682/4766.pbf` 200 og 233 444 byte; `GET /api/enheter/statistikk?lat=59.9056&lon=10.7867&radius=2300` 200 med 21 151 enheter; `GET /api/enheter/punkter` (gammel) 200, 9 646 721 byte; `GET /api/bygg-oversikt/80206887` 200; `POST /api/bygg/refresh` 200 (`mv_bygg_med_koordinater` finnes og kan oppdateres CONCURRENTLY).
  Merk: WebApi-testen kjørte mot første testkjøring (uten ANALYZE); samme SQL-objekter, og tallene i andre kjøring er sammenlignet på SQL-nivå.
- Manglende dump: en container uten `/import`-montering stopper ved `01_gjenopprett.sh` med feilmeldingen om hvor fila skal ligge (verifisert).

## Usikkert
- Ikke testet: `docker compose up` med faktisk `docker-compose.yaml` (hovedsesjonen endrer den; jeg brukte `docker run` med samme monteringer). Ikke testet på Linux/macOS-vert. Linjeskift: `.gitattributes` tvinger LF på `*.sh`; jeg lagde fila med LF, men en klone på Windows uten `.gitattributes` kan gi CRLF og `bad interpreter`.
- Hvis `01_gjenopprett.sh` mangler kjørebit i Git, kjører entrypoint den med `source`; det fungerer (verifisert på Windows-mount), men `exit 1` stopper da hele entrypoint (ønsket her).
- `eiendom_id_seq` settes til `max("bygningID")` (650 136), live står på 650 137. Uten betydning så lenge ingen setter inn nye bygg.
- Dumpen er laget med `-t` på 12 tabeller, så alt annet i live (andre sekvenser, funksjoner, view) følger ikke med; den er bevisst ikke regenerert. Skal grunndata oppdateres, må ny dump lages med `--sequence`-info eller `00_sekvens.sql` utvides.
- Hver ny bygging gir ny tilfeldig salt (`enhet_kart_salt`) og dermed nye punkt-id-er; riktig, men frontend/cache kan ikke gjenbruke id-er mellom databaser.
- README (hovedsesjonen) må beskrive: hvor `grunndata.dump` ligger, at init kjører bare på tomt volum, og at `SELECT refresh_enheter_kart();` trengs etter hver *ny import* (ikke etter oppbygging).
- Åpne punkt i CLAUDE.md om `05` «kan kjøres på nytt» er rettet i kommentaren; punktet kan strykes.

## Lær dette
**`/docker-entrypoint-initdb.d`**: Postgres-imaget kjører alle `.sql`- og `.sh`-filer i denne mappen i navnerekkefølge, men bare første gang datavolumet er tomt. `.sql` kjøres med psql (stopper ved første feil), `.sh` med bash. Derfor står tallprefikset i filnavnene: det ER kjørerekkefølgen, og derfor må man slette volumet for å bygge på nytt. Monterer du din egen mappe over den, forsvinner imagets egne skript (som `10_postgis.sh`), så alt du trenger må du lage selv.
**`pg_restore`** leser en dump i custom-format (`pg_dump -Fc`) og gjenskaper tabeller, data og indekser. Den tar ikke med planleggerstatistikk, så kjør `ANALYZE` etterpå, ellers kan Postgres velge trege planer når du bygger views rett etter (her: 6 min mot 41 s).
