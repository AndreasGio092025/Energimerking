# 2026-11-19 sql-agent: bygg-laget henter kategori og byggeår innen ordning

**Hva:** I `mv_enhet_bygg_punkt` (`Backend/Docker/db-init/10_enkel_bygg_tiles.sql`) velges `bygningskategori`, `byggeaar` og `kohort` nå fra byggets siste attest innen samme ordning (en rad per bygningsnummer og ordning), ikke på tvers av ordningene. `bygg_oversikt_json` (07) er uendret. Installert på live-DB.

**Hvorfor:** Eierens beslutning 2026-11-19: bygg-laget skal vise samme byggeårsgruppe som enhetene i samme ordning. Før ble en 2026-attest med annet byggeår brukt også i gammel-laget. Endringen er `DISTINCT ON (bygningsnummer, ordning)` i CTE-en `siste`, og join på både bygningsnummer og ordning. Forkastet: å rette det i `mv_siste_attest_per_enhet` (05); det ville berørt bygg-siden, som skal være uendret. Ingen JSON-felt er endret, så `docs/api-kontrakt.md` er urørt.

**Testet:**
- Live (`energimerke-db`): kjørte 10, deretter `SELECT refresh_enheter_kart();` (34,9 s totalt). `mv_enhet_bygg_punkt` 21 053 rader (som før), `mv_enhet_punkt` 121 536.
- Avvik, bygg der byggets kohort er en annen enn enhetenes når enhetene er enige: **180 før, 0 etter**. Kategori: 222 før, 0 etter. (Reviewers 509 telte trolig også bygg der enhetene selv er uenige, se Usikkert.)
- Tiles z=14, y=4765 (første kall / varmt kall, `enkel_bygg_tile(..., 'bygg', ...)`): gammel 8685 = 11 340 byte, gammel 8686 = 18 120 byte, ny 8685 = 2 218 byte, ny 8686 = 2 186 byte. Alle fire kall tok 73 ms første gang og 5 ms varmt.
- Tre stikkprøver mot `mv_siste_attest_per_enhet`: bygg 300115315 (gammel: Kontorbygg 2000, ny: Universitets- og høgskolebygg 2010), 300123388 (gammel 2011, ny 2012) og 300136035 (gammel 2012 fra attest 31d139e5 av 2025-04-10, selv om eldre gammel-attester har 2013; ny 2012 fra attest a13dba61 av 2026-05-21, selv om en eldre ny har 2011). Bygg-laget viser i alle tre den nyeste attesten innen sin ordning.
- Tom database (container `energimerke-tmp-sqltest`, ny tom DB `tom`, droppet etterpå, containeren stoppet): se Usikkert for hva som kreves. Med grunntabellene som tomt skjema (hentet med `pg_dump -s` fra live, ingen data) kjørte 02, 04, 05, 06, 07, 08, 09 og 10 uten feil, og 10 kjørt en gang til også uten feil. `refresh_enheter_kart()` ga 0 rader i alle views, og `enkel_bygg_tile` ga tom tile (0 byte).

**Usikkert:**
- Uten grunntabellene feiler db-init: 02, 04, 05, 07-10 trenger tabellene `denorm_matrikkel_og_enova_oslo`, `energimerke` m.fl., som bare lages av `01_gjenopprett.sh` fra `grunndata.dump` (ikke fra noen .sql-fil). 01 kunne ikke kjøres her (ingen dump i testcontaineren), så den ble erstattet med skjema fra live. 00_extensions og 00_sekvens kjører uten data. I mitt skjemaeksport feilet to GIN-indekser fordi jeg hoppet over 00_extensions (pg_trgm); det gjelder ikke ekte init.
- 367 bygg har enheter som selv er uenige om kohort innen samme ordning (ulike byggeår på ulike attester). Bygg-laget viser da byggets siste attest, og kohorten er en av enhetenes; 0 av dem matcher ingen enhet. Dette er forventet, ikke en feil, men eieren kan vurdere om det bør vises.
- `custom_ST_GetPoints` er ikke fjernet fra live-DB (egen jobb).
- Frontend-cache av gamle tiles kan vise gamle verdier til de utløper.

**Lær dette:** `DISTINCT ON (a, b) ... ORDER BY a, b, tid DESC` velger én rad per kombinasjon av a og b, den med høyest tid. Her gir `(bygningsnummer, ordning)` «siste attest per bygg innen ordningen». Uten `ordning` i nøkkelen vant den nyeste attesten på tvers av ordningene og blandet dem, som CLAUDE.md forbyr.
