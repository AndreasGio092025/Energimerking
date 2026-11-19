-- 10_enkel_bygg_tiles.sql
-- Vektor-tiles (MVT) for «Enkel bygg» i kartet, per enhet og per bygg. Feltnavn og typer følger
-- docs/api-kontrakt.md, seksjonen «Vektor-tiles for «Enkel bygg», per enhet og per bygg».
-- Erstatter custom_ST_GetPoints (tidligere 03_tile_functions.sql, nå fjernet): den lagde ett punkt
-- per ATTEST fra denorm-tabellen (bare 2025), mens CLAUDE.md krever at kartet viser ENHETER.
--
-- Kjøres etter 08 (mv_enhet_punkt) og 09. Kan kjøres på nytt: viewet droppes og bygges om,
-- funksjonene er CREATE OR REPLACE. Kjører du 08 på nytt, må du først droppe viewet i denne filen
-- (08 dropper mv_enhet_punkt uten CASCADE, og dette viewet bygger på det):
--   DROP MATERIALIZED VIEW IF EXISTS mv_enhet_bygg_punkt;
-- og deretter kjøre 08 og 10 på nytt i den rekkefølgen.
--
-- Bygger på:
--   mv_enhet_punkt             ett punkt per enhet og ordning, geometry(Point, 25832) + GiST (08)
--   mv_siste_attest_per_enhet  byggets siste attest innen ordningen (kategori, byggeår) (05)
--   byggeaar_kohort()          kohortgrensene (06); grensene gjentas ikke her
--
-- Personvern: tilene inneholder aldri attestnummer, bruksenhetsnummer eller enhet_id. Feltlisten
-- under er skrevet ut med navn (ikke SELECT *), så en ny kolonne i viewene aldri lekker ut av seg selv.
--
-- VIKTIG: kommandoen etter import er fortsatt   SELECT refresh_enheter_kart();   Den er utvidet
-- under (del 2) til å oppdatere bygg-viewet også. Kjører du 08 på nytt, må 10 kjøres etter den,
-- ellers er refresh_enheter_kart() stilt tilbake til 08-versjonen.

-- ---------------------------------------------------------------------------------------------
-- 1. mv_enhet_bygg_punkt: ett punkt per (bygg, ordning) med alt bygg-laget trenger
-- ---------------------------------------------------------------------------------------------
-- Hvorfor et materialisert view: medianene og midtpunktet krever gruppering over 120k enheter. Gjort
-- per tile ville hver tile tatt sekunder; her gjøres det én gang per import, og tile-kallet blir en
-- romlig indeks-spørring.
-- Ordningene grupperes hver for seg (GROUP BY ... ordning): gammel og ny blandes aldri (CLAUDE.md).
--
-- Hva som telles: ALLE enheter i bygget med siste attest i ordningen (også de uten kartpunkt), slik at
-- antall_enheter og medianene stemmer med bygg_oversikt_json (07). Bare midtpunktet bygges av de
-- enhetene som har punkt. Bygg uten noen enhet med punkt i ordningen kan ikke tegnes og er ikke med.
--
-- Midtpunkt: ST_Centroid av ST_Collect av enhetspunktene (gjennomsnitt av x og y i meter, UTM 25832).
-- For et bygg med inngang i to ender havner punktet midt mellom; det er meningen («midtpunktet av
-- byggets enhetspunkter», kontrakten). Enheter på samme koordinat teller likt per enhet, så en blokk
-- med 40 leiligheter på ett punkt trekker midtpunktet mot det punktet i forhold til antall.
--
-- median_karakter: sorter karakterene A -> G og ta den midterste; ved partall den dårligste av de to
-- midterste. Med n karakterer (1-basert) er det element floor(n/2)+1 i begge tilfeller: n = 5 gir
-- element 3 (midten), n = 4 gir element 3 (den dårligste av nr. 2 og 3). Bokstavene A-G sorterer
-- riktig alfabetisk uansett kollasjon. Karakterer som mangler (NULL) teller ikke med.
--
-- median_kwh_m2: percentile_cont(0.5), som i bygg_oversikt_json (07), én desimal. Ved partall
-- antall gir det snittet av de to midterste (til forskjell fra karakteren, som er en rangert verdi
-- og ikke kan midles).
--
-- adresse / antall_adresser: som «Innganger» i bygg_oversikt_json (trimmet, tomme utelatt), men per
-- ordning: adressene til enhetene popupen faktisk viser. Første adresse alfabetisk (databasens kollasjon).
--
-- bygningskategori / byggeaar / kohort: fra byggets siste attest INNEN ordningen (høyeste
-- utstedelsestidspunkt, attestnummer som tie-break, begge innen samme ordning). Eierens beslutning
-- 2026-11-19: bygg-laget skal vise samme byggeårsgruppe som enhetene i samme ordning. Tidligere ble
-- siste attest valgt på tvers av ordningene, så et bygg med en ny attest (2026) med annet byggeår enn
-- de gamle fikk 2026-verdien også i gammel-laget, og kohorten ble en annen enn enhetenes (509 bygg,
-- 2,4 %). Nå velges én rad per (bygningsnummer, ordning), og ordningene blandes aldri.
-- Bygg-siden (bygg_oversikt_json, 07) er bevisst uendret: den viser ett bygg på tvers av ordningene.
DROP MATERIALIZED VIEW IF EXISTS mv_enhet_bygg_punkt;

CREATE MATERIALIZED VIEW mv_enhet_bygg_punkt AS
WITH siste AS (
    SELECT DISTINCT ON (m.bygningsnummer, m.ordning)
           m.bygningsnummer, m.ordning, m.bygningskategori, m.byggeaar
    FROM mv_siste_attest_per_enhet m
    ORDER BY m.bygningsnummer, m.ordning, m.utstedt_tidspunkt DESC, m.attestnummer DESC
),
g AS (
    SELECT
        p.bygningsnummer,
        p.ordning,
        count(*)::int AS antall_enheter,
        ST_Centroid(ST_Collect(p.punkt) FILTER (WHERE p.punkt IS NOT NULL)) AS punkt,
        min(NULLIF(btrim(p.adresse), '')) AS adresse,
        count(DISTINCT NULLIF(btrim(p.adresse), ''))::int AS antall_adresser,
        array_agg(p.energikarakter ORDER BY p.energikarakter) FILTER (WHERE p.energikarakter IS NOT NULL) AS karakterer,
        round((percentile_cont(0.5) WITHIN GROUP (ORDER BY p.energi_kwh_m2::float8))::numeric, 1) AS median_kwh_m2
    FROM mv_enhet_punkt p
    GROUP BY p.bygningsnummer, p.ordning
)
SELECT
    g.bygningsnummer,
    g.ordning,
    g.punkt,
    g.adresse,
    g.antall_adresser,
    g.antall_enheter,
    -- floor(n/2)+1: midterste, og ved partall den dårligste av de to midterste (se over).
    g.karakterer[(cardinality(g.karakterer) / 2) + 1] AS median_karakter,
    g.median_kwh_m2,
    s.bygningskategori,
    s.byggeaar,
    byggeaar_kohort(s.byggeaar) AS kohort
FROM g
JOIN siste s ON s.bygningsnummer = g.bygningsnummer AND s.ordning = g.ordning
WHERE g.punkt IS NOT NULL;
-- (cardinality / 2 er heltallsdivisjon i Postgres, altså floor for positive tall.)

-- Unik nøkkel: kreves for REFRESH ... CONCURRENTLY, og gir oppslag per bygg.
CREATE UNIQUE INDEX ux_mv_enhet_bygg_punkt ON mv_enhet_bygg_punkt (bygningsnummer, ordning);
-- Romlig GiST-indeks: lar tile-spørringen finne byggene i en tile uten å lese alle.
CREATE INDEX ix_mv_enhet_bygg_punkt_geo ON mv_enhet_bygg_punkt USING gist (punkt);
ANALYZE mv_enhet_bygg_punkt;

-- ---------------------------------------------------------------------------------------------
-- 2. refresh_enheter_kart: oppdater alt bak kartet, nå også bygg-punktene
-- ---------------------------------------------------------------------------------------------
-- Samme funksjon og navn som i 08, så kommandoen etter import er uendret. Her utvidet med
-- mv_enhet_bygg_punkt, som må komme sist fordi den bygger på mv_enhet_punkt.
CREATE OR REPLACE FUNCTION refresh_enheter_kart()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_ut text;
    v_n bigint;
    v_b bigint;
BEGIN
    v_ut := refresh_bygg_oversikt();
    REFRESH MATERIALIZED VIEW mv_enhet_punkt;
    REFRESH MATERIALIZED VIEW mv_enhet_punkt_oversikt;
    REFRESH MATERIALIZED VIEW mv_enhet_bygg_punkt;
    SELECT count(*) INTO v_n FROM mv_enhet_punkt;
    SELECT count(*) INTO v_b FROM mv_enhet_bygg_punkt;
    RETURN v_ut || ', mv_enhet_punkt: ' || v_n || ' rader, mv_enhet_bygg_punkt: ' || v_b || ' rader';
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. enkel_bygg_tile_med_tak: selve tile-byggingen, med tak som parameter
-- ---------------------------------------------------------------------------------------------
-- Hvorfor to funksjoner: kontrakten har faste tak (5000 / 8000), og dem bruker enkel_bygg_tile.
-- Takparameteren er skilt ut så testene kan hente en tile uten kapping og telle at alle punkter
-- er med; den er ikke ment å kalles av API-et.
--
-- Koordinatsystem: punktene ligger i 25832 (UTM 32, meter), kartet vil ha Web Mercator (3857).
--  - Utvalg: tile-firkanten (ST_TileEnvelope, 3857) med margin på 64 av 4096 enheter gjøres om til
--    25832, og punktene velges med ST_Intersects (bruker GiST-indeksen). Kantene deles først opp
--    (ST_Segmentize) fordi en rett linje i 3857 er svakt buet i UTM; uten oppdeling ville bare
--    hjørnene blitt omregnet, og firkanten (skjev på grunn av meridiankonvergens, ca. 1,5 grad i
--    Oslo) kunne bomme med noen meter. Utvalget skjer FØR taket: en ren boks-test (&&) tok med
--    punkter utenfor tilen, som fylte taket og ble kuttet bort etterpå, så tilen fikk under 5000.
--  - Tegning: bare de utvalgte punktene (maks tak) omregnes til 3857 og gjøres om til tile-koordinater
--    med ST_AsMVTGeom (4096 enheter, 64 i buffer så punkter på kanten finnes i begge nabotiles).
-- Tak: sorteres på punkt_id / bygningsnummer før LIMIT, så samme tile gir samme punkter hver gang
-- og ikke de som tilfeldigvis ligger først på disken. For enheter er id en hash, så utvalget ved lav
-- zoom blir et jevnt tilfeldig utvalg i stedet for en hel bydel.
CREATE OR REPLACE FUNCTION enkel_bygg_tile_med_tak(
    p_z integer, p_x integer, p_y integer, p_visning text, p_ordning text, p_tak integer)
RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
-- JIT av: for korte spørringer koster JIT-kompilering mer (30-60 ms) enn den sparer.
SET jit = off
AS $$
DECLARE
    v_tile  geometry;
    v_utvalg  geometry;
    v_res   bytea;
BEGIN
    IF p_visning IS NULL OR p_visning NOT IN ('enheter', 'bygg') THEN
        RAISE EXCEPTION 'ugyldig visning: % (bruk enheter eller bygg)', p_visning USING ERRCODE = '22023';
    END IF;
    IF p_ordning IS NULL OR p_ordning NOT IN ('gammel', 'ny') THEN
        RAISE EXCEPTION 'ugyldig ordning: % (bruk gammel eller ny)', p_ordning USING ERRCODE = '22023';
    END IF;
    IF p_z IS NULL OR p_x IS NULL OR p_y IS NULL OR p_z NOT BETWEEN 0 AND 22
       OR p_x NOT BETWEEN 0 AND (1 << p_z) - 1 OR p_y NOT BETWEEN 0 AND (1 << p_z) - 1 THEN
        RAISE EXCEPTION 'ugyldig tile: z=%, x=%, y=%', p_z, p_x, p_y USING ERRCODE = '22023';
    END IF;
    -- Under zoom 10 er kartet for utzoomet til at enkeltpunkter gir mening: tom tile.
    IF p_z < 10 THEN
        RETURN ''::bytea;
    END IF;

    v_tile := ST_TileEnvelope(p_z, p_x, p_y);
    v_utvalg := ST_Transform(
        ST_Segmentize(ST_TileEnvelope(p_z, p_x, p_y, margin => 64.0 / 4096),
                      (ST_XMax(v_tile) - ST_XMin(v_tile)) / 4),
        25832);

    IF p_visning = 'enheter' THEN
        SELECT coalesce(ST_AsMVT(q, 'enheter', 4096, 'geom'), ''::bytea) INTO v_res
        FROM (
            SELECT ST_AsMVTGeom(ST_Transform(c.punkt, 3857), v_tile, 4096, 64, true) AS geom,
                   c.punkt_id AS id,
                   c.ordning,
                   c.bygningsnummer,
                   c.adresse,
                   c.bygningskategori,
                   c.byggeaar,
                   c.kohort,
                   c.energikarakter,
                   c.oppvarmingskarakter,
                   round(c.energi_kwh_m2, 1)::float8 AS energi_kwh_m2,
                   c.utstedelsesdato::text AS utstedelsesdato,
                   c.antall_samme_punkt AS antall_enheter_samme_punkt
            FROM (
                SELECT p.punkt, p.punkt_id, p.ordning, p.bygningsnummer, p.adresse, p.bygningskategori,
                       p.byggeaar, p.kohort, p.energikarakter, p.oppvarmingskarakter, p.energi_kwh_m2,
                       p.utstedelsesdato, p.antall_samme_punkt
                FROM mv_enhet_punkt p
                WHERE p.punkt IS NOT NULL AND ST_Intersects(p.punkt, v_utvalg) AND p.ordning = p_ordning
                ORDER BY p.punkt_id
                LIMIT p_tak
            ) c
        ) q
        WHERE q.geom IS NOT NULL;
    ELSE
        SELECT coalesce(ST_AsMVT(q, 'bygg', 4096, 'geom'), ''::bytea) INTO v_res
        FROM (
            SELECT ST_AsMVTGeom(ST_Transform(c.punkt, 3857), v_tile, 4096, 64, true) AS geom,
                   c.bygningsnummer,
                   c.ordning,
                   c.adresse,
                   c.antall_adresser,
                   c.antall_enheter,
                   c.median_karakter,
                   c.median_kwh_m2::float8 AS median_kwh_m2,
                   c.bygningskategori,
                   c.byggeaar,
                   c.kohort
            FROM (
                SELECT b.punkt, b.bygningsnummer, b.ordning, b.adresse, b.antall_adresser, b.antall_enheter,
                       b.median_karakter, b.median_kwh_m2, b.bygningskategori, b.byggeaar, b.kohort
                FROM mv_enhet_bygg_punkt b
                WHERE ST_Intersects(b.punkt, v_utvalg) AND b.ordning = p_ordning
                ORDER BY b.bygningsnummer
                LIMIT p_tak
            ) c
        ) q
        WHERE q.geom IS NOT NULL;
    END IF;
    RETURN v_res;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. enkel_bygg_tile(z, x, y, visning, ordning): funksjonen API-et kaller
-- ---------------------------------------------------------------------------------------------
-- visning: 'enheter' eller 'bygg'. ordning: 'gammel' eller 'ny' (aldri 'alle': ordningene blandes
-- ikke i samme kart). Ugyldig verdi gir feil med SQLSTATE 22023 (controlleren validerer også).
-- Under zoom 10: tom bytea (controlleren svarer 204). Tak: 5000 under zoom 13, ellers 8000.
-- Kall posisjonelt: SELECT enkel_bygg_tile(14, 8682, 4766, 'bygg', 'gammel');
CREATE OR REPLACE FUNCTION enkel_bygg_tile(
    p_z integer, p_x integer, p_y integer,
    p_visning text DEFAULT 'enheter', p_ordning text DEFAULT 'gammel')
RETURNS bytea
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT enkel_bygg_tile_med_tak(p_z, p_x, p_y, p_visning, p_ordning,
                                   CASE WHEN p_z < 13 THEN 5000 ELSE 8000 END)
$$;
