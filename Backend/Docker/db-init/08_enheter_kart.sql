-- 08_enheter_kart.sql
-- SQL bak de nye enhetsrutene i kartet (api/enheter/punkter og api/enheter/statistikk). Feltnavn og
-- typer følger docs/api-kontrakt.md, seksjonen "Enheter i kartet", nøyaktig. API-et (C#) skal bare
-- videresende JSON-en; all regnelogikk ligger her.
-- Kan kjøres på nytt: funksjoner er CREATE OR REPLACE, våre egne materialiserte views droppes og
-- bygges på nytt. Filen rører ingen eksisterende objekter (04-07 og eldre).
--
-- Bygger på:
--   mv_siste_attest_per_enhet  siste attest per enhet og ordning (05). Enhetene vi teller.
--   v_attester                 alle attester (04). Brukes bare til antall attester per enhet.
--   byggeaar_kohort()          kohortgrensene (06). Grensene gjentas ikke her.
--   denorm_matrikkel_og_enova_oslo, energiattester, coordinates, eiendom: koordinatkilder.
--
-- Personvern: funksjonene gir aldri bruksenhetsnummer, attestnummer eller enhet_id i utdata.
-- Punkt-id er en saltet hash (se del 0), så den ikke kan regnes ut fra adresse + bruksenhetsnummer.
--
-- VIKTIG: kjør   SELECT refresh_enheter_kart();   etter HVER import av attester. Den kjører
-- refresh_bygg_oversikt() først (07) og deretter viewet i denne filen, i riktig rekkefølge.
-- Kjører du bare refresh_bygg_oversikt(), blir kartpunktene stående på forrige import.

-- ---------------------------------------------------------------------------------------------
-- 0. Salt til punkt-id
-- ---------------------------------------------------------------------------------------------
-- Punkt-id skal være stabil (samme enhet = samme id mellom kall og refresh), men ikke avsløre
-- enhet_id. enhet_id = bygningsnummer|bruksenhetsnummer|adresse, og bruksenhetsnumre ser ut som
-- H0101, H0102 ... Adresse og bygningsnummer er offentlige, så en usaltet md5 kunne knekkes ved å
-- prøve alle H01xx. Derfor saltes hashen med en tilfeldig verdi som lages én gang per database og
-- aldri står i repoet. Tabellen har høyst én rad (CHECK) og INSERT ... WHERE NOT EXISTS gjør at
-- salt ikke endres når filen kjøres på nytt. Konsekvens: samme enhet kan få en annen id i en
-- annen database (f.eks. en kopi); det er greit, id brukes bare som React-/kartnøkkel.
CREATE TABLE IF NOT EXISTS enhet_kart_salt (
    onerow boolean PRIMARY KEY DEFAULT true CHECK (onerow),
    salt   text NOT NULL
);
INSERT INTO enhet_kart_salt (salt)
SELECT md5(random()::text || clock_timestamp()::text || random()::text)
WHERE NOT EXISTS (SELECT 1 FROM enhet_kart_salt);

-- ---------------------------------------------------------------------------------------------
-- 1. mv_enhet_punkt: én rad per (enhet, ordning) med kartpunkt og alt kartet trenger
-- ---------------------------------------------------------------------------------------------
-- Hvorfor et materialisert view: koordinaten må finnes via en kjede av oppslag (se under) og
-- antall attester krever en gruppering over v_attester (126k + 18k rader mot enova_raw). Det vil
-- vi ikke gjøre per kartkall. Her gjøres det én gang per import; kartkallene blir en romlig
-- indeks-spørring (ms).
--
-- Geometri: geometry(Point, 25832) (ETRS89 / UTM sone 32, meter), ikke lat/lon-grader. Årsaker:
--  (1) Avstand i meter: i UTM er ST_DWithin(…, 2300) en vanlig planar avstand i meter. Skalafeilen i
--      Oslo er ca. 0,03 %, altså under 1 m på 2300 m. (geography-typen regner på kloden og var målt
--      tregere, med en løsere indeks-boks.)
--  (2) Kildene er ETRS89 (4258) og brukerens lat/lon regnes som det samme (WGS84 avviker under en
--      meter i Norge), så vi omregner begge til 25832 med ST_Transform og trenger ingen datumskifte.
-- lat/lon (6 desimaler, ~0,1 m) lagres også, til GeoJSON-utdata. Avrundingen gjør "identisk
-- koordinat" veldefinert (en blokk gir nøyaktig samme punkt) uten at flyttallsstøy deler dem opp.
-- Rader legges i romlig rekkefølge (ORDER BY geohash, nederst): punkter som ligger nær hverandre
-- havner på samme disksider, så en kartsirkel leser få sider i stedet for hele tabellen.
-- feature: ferdig GeoJSON-Feature per rad (bygges én gang her, ikke ved hvert kall; målt: å bygge
-- 21 000 objekter per kall tok ~0,7 s, mens å lime sammen ferdige tok brøkdelen).
--
-- Koordinatkjede (første treff vinner; kolonnen punkt_metode sier hvilken som ble brukt):
--   a_attest          attestens egen rad i denorm_matrikkel_og_enova_oslo (kun 2025-attester).
--   b_annen_ordning   samme enhet_id i den andre ordningen har koordinat via (a). Samme bruksenhet,
--                     altså samme adresse: trygt.
--   c_bygg_adresse    annen enhet i samme bygg, med samme adresse, har koordinat via (a).
--   d_matrikkel_adr   coordinates: samme gnr/bnr OG samme adresse (adressepunktet).
--   c_bygg            annen enhet i samme bygg (annen inngang/adresse) har koordinat via (a).
--   d_matrikkel_gb   coordinates: samme gnr/bnr, en annen adresse på eiendommen. Vi velger punktet
--                     nærmest tyngdepunktet av eiendommens punkter, så vi ikke havner ytterst.
--   (eiendom brukes IKKE: eiendom.coordinateid peker ofte på en annen eiendoms punkt. Målt: for de 99
--   enhetene som bare eiendom kunne gi punkt til, lå punktet i median 313 m (maks 1,6 km) fra nærmeste
--   enhet i samme gate, og eiendommens egne rader pekte på punkter med andre gnr/bnr. Å la dem stå
--   uten punkt er bedre enn å plassere dem feil. Treff som er riktige ligger uansett i coordinates.)
--   ingen           ingen koordinat. Raden er med (punkt NULL) så vi kan telle dem, men vises ikke.
-- Rekkefølgen avviker bevisst fra oppgavens a-b-c-d: adressepunktet i matrikkelen (d_matrikkel_adr)
-- går foran "samme bygg, annen adresse" (c_bygg). Målt: der begge finnes, ligger c_bygg-punktet i
-- median 19 m (90 %: 42 m, maks 134 m) fra adressepunktet, mens c_bygg_adresse faller sammen med
-- adressepunktet (0 m). Et punkt på riktig adresse er altså bedre enn et nabopunkt i bygget.
-- Hvorfor denne rekkefølgen: dyktigst først. Treff på enhetens egen attest eller samme enhet i
-- andre ordning er sikre; samme bygg er nesten like sikkert; matrikkel gir punkt på eiendommen.
-- Hver kilde brukes bare hvis punktet ligger i Oslo-området (bbox, se enhet_punkt_i_oslo) så ett
-- ødelagt punkt ikke sender en enhet til feil sted.
--
-- Matrikkelnøkkel (gnr/bnr): 2026-attester har den i energiattester (tekst), 2025-attester i
-- denorm-tabellen (tall). Vi leser den fra begge, så også 2025-attester uten koordinat (men med
-- gnr/bnr) kan kobles.
-- Oversikten bygger på mv_enhet_punkt, så den droppes først.
DROP MATERIALIZED VIEW IF EXISTS mv_enhet_punkt_oversikt;
DROP MATERIALIZED VIEW IF EXISTS mv_enhet_punkt;
DROP FUNCTION IF EXISTS enhet_punkt_i_oslo(geometry);

-- (ST_X/ST_Y skrives med "public." fordi Postgres leser funksjonskroppen med et begrenset
-- søkesti når et materialisert view bygges eller oppdateres; uten prefiks finner den ikke PostGIS.)
-- Sikkerhetsnett: grov Oslo-boks (lat 59.6-60.3, lon 10.3-11.2). Målt: ingen punkter faller utenfor
-- i dag; vakten er til for fremtidige importer med 0,0 eller ombyttet lat/lon.
CREATE FUNCTION enhet_punkt_i_oslo(g geometry)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT g IS NOT NULL
       AND public.ST_Y(g) BETWEEN 59.6 AND 60.3
       AND public.ST_X(g) BETWEEN 10.3 AND 11.2
$$;

CREATE MATERIALIZED VIEW mv_enhet_punkt AS
WITH base AS (
    -- Enhetene (siste attest per ordning) med egen koordinat (a) og matrikkelnøkkel.
    SELECT
        m.enhet_id, m.ordning, m.bygningsnummer, m.attestnummer,
        -- Samme normalisering av adresse som i enhet_id (04), så "lik adresse" betyr det samme overalt.
        lower(regexp_replace(trim(m.adresse), '\s+', ' ', 'g')) AS adr_n,
        CASE WHEN enhet_punkt_i_oslo(d.coordinate::geometry) THEN d.coordinate::geometry END AS g_a,
        coalesce(d."gaardsNr"::int, CASE WHEN e.gnr ~ '^\d{1,6}$' THEN e.gnr::int END) AS gnr,
        coalesce(d."bruksNr"::int,  CASE WHEN e.bnr ~ '^\d{1,6}$' THEN e.bnr::int END) AS bnr
    FROM mv_siste_attest_per_enhet m
    LEFT JOIN denorm_matrikkel_og_enova_oslo d ON d."attestNr" = m.attestnummer
    LEFT JOIN energiattester e ON e.knr = '0301' AND e.attestnummer = m.attestnummer
),
-- (c) Kjente punkter per bygg og adresse / per bygg. Ett punkt per nøkkel, med fast rekkefølge
-- (laveste attestnummer) så to kjøringer gir samme fasit.
bygg_adr AS (
    SELECT DISTINCT ON (bygningsnummer, adr_n) bygningsnummer, adr_n, g_a AS g
    FROM base WHERE g_a IS NOT NULL
    ORDER BY bygningsnummer, adr_n, attestnummer
),
bygg AS (
    SELECT DISTINCT ON (bygningsnummer) bygningsnummer, g_a AS g
    FROM base WHERE g_a IS NOT NULL
    ORDER BY bygningsnummer, attestnummer
),
-- (d) Matrikkelkilder. coordinates har ett punkt per adresse; en eiendom (gnr/bnr) kan ha flere.
coord AS (
    SELECT c.coordinateid, c.gaardsnummer AS gnr, c.bruksnummer AS bnr,
           lower(regexp_replace(trim(c.adresse), '\s+', ' ', 'g')) AS adr_n,
           -- 22 rader har lat/lon men mangler geography-kolonnen; da bygger vi punktet selv.
           coalesce(c.geography::geometry, ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4258)) AS g
    FROM coordinates c
    WHERE c.kommunenummer = '0301'
      AND c.gaardsnummer IS NOT NULL AND c.bruksnummer IS NOT NULL
      AND enhet_punkt_i_oslo(coalesce(c.geography::geometry, ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4258)))
),
coord_adr AS (
    SELECT DISTINCT ON (gnr, bnr, adr_n) gnr, bnr, adr_n, g
    FROM coord WHERE adr_n IS NOT NULL
    ORDER BY gnr, bnr, adr_n, coordinateid
),
-- Eiendom uten adressetreff: velg punktet nærmest tyngdepunktet av alle punktene på eiendommen.
-- Grader er ok som avstandsmål her; vi bruker det bare til å rangere punkter på samme eiendom.
coord_gb AS (
    SELECT DISTINCT ON (c.gnr, c.bnr) c.gnr, c.bnr, c.g
    FROM coord c
    JOIN (SELECT gnr, bnr, ST_Centroid(ST_Collect(g)) AS cen FROM coord GROUP BY gnr, bnr) z
      USING (gnr, bnr)
    ORDER BY c.gnr, c.bnr, ST_Distance(c.g, z.cen), c.coordinateid
),
valgt AS (
    SELECT
        b.enhet_id, b.ordning,
        coalesce(b.g_a, o.g_a, ba.g, ca.g, bg.g, cg.g) AS g,
        CASE
            WHEN b.g_a IS NOT NULL  THEN 'a_attest'
            WHEN o.g_a IS NOT NULL  THEN 'b_annen_ordning'
            WHEN ba.g IS NOT NULL   THEN 'c_bygg_adresse'
            WHEN ca.g IS NOT NULL   THEN 'd_matrikkel_adr'
            WHEN bg.g IS NOT NULL   THEN 'c_bygg'
            WHEN cg.g IS NOT NULL   THEN 'd_matrikkel_gb'
            ELSE 'ingen'
        END AS punkt_metode
    FROM base b
    -- (b) Samme enhet i den andre ordningen (høyst én rad, siden det bare finnes to ordninger).
    LEFT JOIN base o  ON o.enhet_id = b.enhet_id AND o.ordning <> b.ordning AND o.g_a IS NOT NULL
    LEFT JOIN bygg_adr ba ON ba.bygningsnummer = b.bygningsnummer AND ba.adr_n = b.adr_n
    LEFT JOIN bygg bg  ON bg.bygningsnummer = b.bygningsnummer
    LEFT JOIN coord_adr ca ON ca.gnr = b.gnr AND ca.bnr = b.bnr AND ca.adr_n = b.adr_n
    LEFT JOIN coord_gb cg  ON cg.gnr = b.gnr AND cg.bnr = b.bnr
),
-- Antall attester per enhet og ordning (til statistikkens antall_attester). Forhåndsberegnet her,
-- fordi v_attester er dyr å lese ved hvert kall.
att AS (
    SELECT enhet_id, ordning, count(*)::int AS antall_attester
    FROM v_attester WHERE enhet_id IS NOT NULL
    GROUP BY enhet_id, ordning
),
rund AS (
    -- Avrund til 6 desimaler (se over) og lag selve punktet.
    SELECT v.enhet_id, v.ordning, v.punkt_metode,
           round(ST_X(v.g)::numeric, 6)::float8 AS lon,
           round(ST_Y(v.g)::numeric, 6)::float8 AS lat
    FROM valgt v
),
ut AS (
    SELECT
        -- Stabil, saltet, ikke-personlig id: 16 hex-tegn (64 bit) er nok til at 121k rader ikke kolliderer,
        -- og kort nok til å være lett som React-nøkkel. Ordning er med så samme enhet får to id-er under "alle".
        left(md5((SELECT salt FROM enhet_kart_salt) || '|' || r.enhet_id || '|' || r.ordning), 16) AS punkt_id,
        r.enhet_id,
        r.ordning,
        r.punkt_metode,
        r.lat,
        r.lon,
        CASE WHEN r.lat IS NOT NULL
             THEN ST_Transform(ST_SetSRID(ST_MakePoint(r.lon, r.lat), 4326), 25832) END AS punkt,
        -- Enheter i samme ordning med identisk koordinat (en blokk). NULL når punktet mangler.
        CASE WHEN r.lat IS NOT NULL
             THEN count(*) OVER (PARTITION BY r.ordning, r.lat, r.lon)::int END AS antall_samme_punkt,
        m.bygningsnummer,
        m.adresse,
        m.bygningskategori,
        m.byggeaar,
        byggeaar_kohort(m.byggeaar) AS kohort,
        m.energikarakter,
        m.oppvarmingskarakter,
        m.energi_kwh_m2,
        m.utstedelsesdato,
        coalesce(a.antall_attester, 0) AS antall_attester
    FROM rund r
    JOIN mv_siste_attest_per_enhet m ON m.enhet_id = r.enhet_id AND m.ordning = r.ordning
    LEFT JOIN att a ON a.enhet_id = r.enhet_id AND a.ordning = r.ordning
)
SELECT
    u.*,
    CASE WHEN u.lat IS NOT NULL THEN json_build_object(
        'type', 'Feature',
        'geometry', json_build_object('type', 'Point', 'coordinates', json_build_array(u.lon, u.lat)),
        'properties', json_build_object(
            'id', u.punkt_id,
            'ordning', u.ordning,
            'bygningsnummer', u.bygningsnummer,
            'adresse', u.adresse,
            'bygningskategori', u.bygningskategori,
            'byggeaar', u.byggeaar,
            'kohort', u.kohort,
            'energikarakter', u.energikarakter,
            'oppvarmingskarakter', u.oppvarmingskarakter,
            'energi_kwh_m2', round(u.energi_kwh_m2, 1),
            'utstedelsesdato', u.utstedelsesdato,
            'antall_enheter_samme_punkt', u.antall_samme_punkt)) END AS feature
FROM ut u
-- Romlig sortering (geohash) av radene; enheter uten punkt til slutt.
ORDER BY ST_GeoHash(ST_SetSRID(ST_MakePoint(u.lon, u.lat), 4326), 10) NULLS LAST, u.punkt_id;

-- Unik nøkkel: kreves for REFRESH ... CONCURRENTLY, og gir oppslag per enhet.
CREATE UNIQUE INDEX ux_mv_enhet_punkt_enhet ON mv_enhet_punkt (enhet_id, ordning);
CREATE UNIQUE INDEX ux_mv_enhet_punkt_id ON mv_enhet_punkt (punkt_id);
-- Romlig GiST-indeks: lar ST_DWithin finne punktene i en sirkel uten å lese alle 120k rader.
-- Delvis indeks (bare rader med punkt): enhetene uten koordinat tas ikke med, og indeksen blir mindre.
CREATE INDEX ix_mv_enhet_punkt_geo ON mv_enhet_punkt USING gist (punkt) WHERE punkt IS NOT NULL;

-- Liten oversikt per ordning for hele Oslo (tre tall som ellers ville krevd skanning av alle rader
-- ved hvert statistikkall): enheter uten kartpunkt og periode. Egen mv, så den oppdateres sammen
-- med resten og aldri blir ute av takt.
DROP MATERIALIZED VIEW IF EXISTS mv_enhet_punkt_oversikt;
CREATE MATERIALIZED VIEW mv_enhet_punkt_oversikt AS
SELECT p.ordning,
       count(*)::int AS antall_enheter,
       count(*) FILTER (WHERE p.punkt IS NULL)::int AS uten_punkt,
       min(extract(year FROM p.utstedelsesdato))::int AS aar_min,
       max(extract(year FROM p.utstedelsesdato))::int AS aar_maks
FROM mv_enhet_punkt p GROUP BY p.ordning;
CREATE UNIQUE INDEX ux_mv_enhet_punkt_oversikt ON mv_enhet_punkt_oversikt (ordning);
ANALYZE mv_enhet_punkt;
ANALYZE mv_enhet_punkt_oversikt;

-- ---------------------------------------------------------------------------------------------
-- 2. refresh_enheter_kart: oppdater alt bak kartet i riktig rekkefølge
-- ---------------------------------------------------------------------------------------------
-- Hvorfor en ny funksjon og ikke å utvide refresh_bygg_oversikt() i 07: da måtte hele funksjonen
-- gjentas her, og å kjøre 07 på nytt ville stille den tilbake og gjemt det nye viewet. Denne
-- kaller refresh_bygg_oversikt() (som først oppdaterer mv_siste_attest_per_enhet, som vårt view
-- bygger på) og oppdaterer så mv_enhet_punkt.
CREATE OR REPLACE FUNCTION refresh_enheter_kart()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_ut text;
    v_n bigint;
BEGIN
    v_ut := refresh_bygg_oversikt();
    REFRESH MATERIALIZED VIEW mv_enhet_punkt;
    REFRESH MATERIALIZED VIEW mv_enhet_punkt_oversikt;
    SELECT count(*) INTO v_n FROM mv_enhet_punkt;
    RETURN v_ut || ', mv_enhet_punkt: ' || v_n || ' rader';
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. enheter_punkter_json(lat, lon, radius_m, ordning)
-- ---------------------------------------------------------------------------------------------
-- GeoJSON FeatureCollection etter kontrakten. Ordning: 'gammel', 'ny' eller 'alle'.
-- Under 'alle' kan samme enhet gi to punkter (ett per ordning); ordningene blandes aldri i ett punkt.
-- Tak 50 000: vi henter 50 001 rader, sorterer på avstand fra midtpunktet,
-- viser de 50 000 nærmeste og setter avkortet = true hvis rad nr. 50 001 fantes.
-- Dermed mister vi kanten av sirkelen, ikke midten.
-- ST_DWithin(geometri, geometri, meter): UTM-koordinater er i meter, og GiST-indeksen kutter bort alt
-- utenfor sirkelens omskrevne boks før den nøyaktige avstanden sjekkes.
DROP FUNCTION IF EXISTS enheter_punkter_json(double precision, double precision, integer, text);
CREATE OR REPLACE FUNCTION enheter_punkter_json(
    p_lat double precision, p_lon double precision, p_radius_m integer, p_ordning text DEFAULT 'gammel')
RETURNS json
LANGUAGE plpgsql
STABLE
-- JIT av: for korte spørringer koster JIT-kompilering mer (30-60 ms) enn den sparer.
SET jit = off
AS $$
DECLARE
    v_mid geometry;
    v_res json;
BEGIN
    IF p_ordning IS NULL OR p_ordning NOT IN ('gammel', 'ny', 'alle') THEN
        RAISE EXCEPTION 'ugyldig ordning: %', p_ordning USING ERRCODE = '22023';
    END IF;
    IF p_radius_m IS NULL OR p_radius_m < 1 OR p_radius_m > 20000 THEN
        RAISE EXCEPTION 'ugyldig radius: %', p_radius_m USING ERRCODE = '22023';
    END IF;
    IF p_lat IS NULL OR p_lon IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lon NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'ugyldig posisjon' USING ERRCODE = '22023';
    END IF;
    v_mid := ST_Transform(ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326), 25832);

    -- Først bare den romlige avgrensningen (MATERIALIZED), deretter ordningsfilteret. Slås de sammen,
    -- velger Postgres å kombinere GiST-indeksen med en indeks på ordning (som leser alle 108k rader
    -- i den ordningen, fordi den undervurderer hvor mange punkter en sirkel gir). Å ta med begge
    -- ordninger i sirkelen koster bare noen få tusen rader ekstra.
    WITH c AS MATERIALIZED (
        SELECT p.punkt_id, p.ordning, p.punkt, p.feature
        FROM mv_enhet_punkt p
        WHERE p.punkt IS NOT NULL AND ST_DWithin(p.punkt, v_mid, p_radius_m)
    ),
    n AS (
        SELECT c.*, ST_Distance(c.punkt, v_mid) AS avstand
        FROM c
        WHERE p_ordning = 'alle' OR c.ordning = p_ordning
        ORDER BY ST_Distance(c.punkt, v_mid), c.punkt_id
        LIMIT 50001
    ),
    t AS (SELECT n.*, row_number() OVER (ORDER BY n.avstand, n.punkt_id) AS rn FROM n)
    SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', coalesce(
            -- Ferdigbygde Feature-objekter fra mv_enhet_punkt.feature limes bare sammen her.
            json_agg(t.feature ORDER BY t.rn) FILTER (WHERE t.rn <= 50000),
            '[]'::json),
        'avkortet', coalesce(bool_or(t.rn > 50000), false),
        'antall', count(*) FILTER (WHERE t.rn <= 50000)
    )
    INTO v_res
    FROM t;
    RETURN v_res;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. enheter_statistikk_json(lat, lon, radius_m)
-- ---------------------------------------------------------------------------------------------
-- Statistikk over ALLE enheter med punkt i sirkelen (ikke bare de som tegnes i kartet), en rad per
-- ordning. Gammel og ny blandes aldri: alle tall grupperes på ordning.
-- antall_attester: forhåndsberegnet per enhet i mv_enhet_punkt (summeres her).
-- enheter_uten_kartpunkt: enheter uten koordinat i hele Oslo per ordning. Det er bevisst samme tall
-- uansett sirkel; vi vet jo ikke hvor de ligger, så de kan ikke hentes inn eller ut av et område.
-- Karakterfordeling har alltid alle sju nøkler A-G (0 når ingen), slik at frontend slipper
-- å sjekke om nøkler mangler. Kohortfordelingen har alle syv kohorter fra byggeaar_kohort() pluss
-- "ukjent" (bygg uten gyldig byggeår). Kohortnavnene hentes fra byggeaar_kohort() med eksempelår,
-- så grensene fortsatt står ett sted (06).
-- Median og gjennomsnitt gjelder kWh-verdiene som finnes (enheter uten kWh er med i antall, ikke i snittet).
DROP FUNCTION IF EXISTS enheter_statistikk_json(double precision, double precision, integer);
CREATE OR REPLACE FUNCTION enheter_statistikk_json(
    p_lat double precision, p_lon double precision, p_radius_m integer)
RETURNS json
LANGUAGE plpgsql
STABLE
-- JIT av: for korte spørringer koster JIT-kompilering mer (30-60 ms) enn den sparer.
SET jit = off
AS $$
DECLARE
    v_mid geometry;
    v_res json;
BEGIN
    IF p_radius_m IS NULL OR p_radius_m < 1 OR p_radius_m > 20000 THEN
        RAISE EXCEPTION 'ugyldig radius: %', p_radius_m USING ERRCODE = '22023';
    END IF;
    IF p_lat IS NULL OR p_lon IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lon NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'ugyldig posisjon' USING ERRCODE = '22023';
    END IF;
    v_mid := ST_Transform(ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326), 25832);

    WITH s AS (
        -- Alle enheter med punkt i sirkelen, begge ordninger. GiST-indeksen gjør dette raskt.
        SELECT p.ordning, p.bygningsnummer, p.energikarakter, p.oppvarmingskarakter, p.energi_kwh_m2,
               p.byggeaar, p.kohort, p.antall_attester
        FROM mv_enhet_punkt p
        WHERE p.punkt IS NOT NULL AND ST_DWithin(p.punkt, v_mid, p_radius_m)
    ),
    a AS (
        SELECT s.ordning,
               count(*)::int AS antall_enheter,
               sum(s.antall_attester)::int AS antall_attester,
               count(DISTINCT s.bygningsnummer)::int AS antall_bygg,
               count(*) FILTER (WHERE s.energikarakter = 'A')::int AS ka,
               count(*) FILTER (WHERE s.energikarakter = 'B')::int AS kb,
               count(*) FILTER (WHERE s.energikarakter = 'C')::int AS kc,
               count(*) FILTER (WHERE s.energikarakter = 'D')::int AS kd,
               count(*) FILTER (WHERE s.energikarakter = 'E')::int AS ke,
               count(*) FILTER (WHERE s.energikarakter = 'F')::int AS kf,
               count(*) FILTER (WHERE s.energikarakter = 'G')::int AS kg,
               count(*) FILTER (WHERE s.oppvarmingskarakter = 'Green')::int      AS og,
               count(*) FILTER (WHERE s.oppvarmingskarakter = 'LightGreen')::int AS olg,
               count(*) FILTER (WHERE s.oppvarmingskarakter = 'Yellow')::int     AS oy,
               count(*) FILTER (WHERE s.oppvarmingskarakter = 'Orange')::int     AS oo,
               count(*) FILTER (WHERE s.oppvarmingskarakter = 'Red')::int        AS orr,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY s.energi_kwh_m2) AS median_kwh,
               avg(s.energi_kwh_m2) AS snitt_kwh,
               avg(s.byggeaar) AS snitt_aar,
               count(*) FILTER (WHERE s.kohort = byggeaar_kohort(1900))::int AS h1,
               count(*) FILTER (WHERE s.kohort = byggeaar_kohort(1960))::int AS h2,
               count(*) FILTER (WHERE s.kohort = byggeaar_kohort(1980))::int AS h3,
               count(*) FILTER (WHERE s.kohort = byggeaar_kohort(1990))::int AS h4,
               count(*) FILTER (WHERE s.kohort = byggeaar_kohort(2000))::int AS h5,
               count(*) FILTER (WHERE s.kohort = byggeaar_kohort(2010))::int AS h6,
               count(*) FILTER (WHERE s.kohort = byggeaar_kohort(2020))::int AS h7,
               count(*) FILTER (WHERE s.kohort IS NULL)::int AS hukjent
        FROM s GROUP BY s.ordning
    ),
    -- Hele Oslo, per ordning: manglende kartpunkt, og periode til tekstfeltet.
    g AS (
        SELECT ordning, uten_punkt, aar_min, aar_maks FROM mv_enhet_punkt_oversikt
    ),
    o AS (SELECT * FROM (VALUES ('gammel', 1), ('ny', 2)) AS v(ordning, rekkefolge))
    SELECT json_build_object(
        'omrade', json_build_object('lat', p_lat, 'lon', p_lon, 'radius_m', p_radius_m),
        'ordninger', (
            SELECT json_agg(json_build_object(
                'ordning', o.ordning,
                -- Periode fra dataene selv: ett år gir "i 2025", flere gir "i 2024–2025".
                'periode', 'attester utstedt i ' || CASE
                    WHEN g.aar_min IS NULL THEN CASE o.ordning WHEN 'gammel' THEN 'før 2026' ELSE '2026 og senere' END
                    WHEN g.aar_min = g.aar_maks THEN g.aar_min::text
                    ELSE g.aar_min || '–' || g.aar_maks END,
                'antall_enheter', coalesce(a.antall_enheter, 0),
                'antall_attester', coalesce(a.antall_attester, 0),
                'antall_bygg', coalesce(a.antall_bygg, 0),
                'enheter_uten_kartpunkt', coalesce(g.uten_punkt, 0),
                'karakterfordeling', json_build_object(
                    'A', coalesce(a.ka, 0), 'B', coalesce(a.kb, 0), 'C', coalesce(a.kc, 0), 'D', coalesce(a.kd, 0),
                    'E', coalesce(a.ke, 0), 'F', coalesce(a.kf, 0), 'G', coalesce(a.kg, 0)),
                -- Ny ordning har ikke oppvarmingskarakter: null, ikke en tom fordeling (CLAUDE.md).
                'oppvarmingsfordeling', CASE WHEN o.ordning = 'ny' THEN NULL ELSE json_build_object(
                    'Green', coalesce(a.og, 0), 'LightGreen', coalesce(a.olg, 0), 'Yellow', coalesce(a.oy, 0),
                    'Orange', coalesce(a.oo, 0), 'Red', coalesce(a.orr, 0)) END,
                'median_kwh_m2', round(a.median_kwh::numeric, 1),
                'gjennomsnitt_kwh_m2', round(a.snitt_kwh, 1),
                'gjennomsnitt_byggeaar', round(a.snitt_aar)::int,
                'kohortfordeling', json_build_object(
                    byggeaar_kohort(1900), coalesce(a.h1, 0), byggeaar_kohort(1960), coalesce(a.h2, 0),
                    byggeaar_kohort(1980), coalesce(a.h3, 0), byggeaar_kohort(1990), coalesce(a.h4, 0),
                    byggeaar_kohort(2000), coalesce(a.h5, 0), byggeaar_kohort(2010), coalesce(a.h6, 0),
                    byggeaar_kohort(2020), coalesce(a.h7, 0), 'ukjent', coalesce(a.hukjent, 0))
            ) ORDER BY o.rekkefolge)
            FROM o LEFT JOIN a ON a.ordning = o.ordning LEFT JOIN g ON g.ordning = o.ordning)
    )
    INTO v_res;
    RETURN v_res;
END
$$;
