-- 07_bygg_oversikt.sql
-- SQL-funksjonene bak bygg-siden (api/bygg-oversikt). Feltnavn og typer følger docs/api-kontrakt.md,
-- seksjonen "Bygg-oversikt", nøyaktig. API-et (C#) skal bare videresende JSON-en; all regnelogikk
-- ligger her, så reglene for enhet, ordning og lignende bygg står ett sted.
-- Kan kjøres på nytt: funksjoner er CREATE OR REPLACE, våre egne materialiserte views droppes og
-- bygges på nytt. Filen rører ingen eksisterende objekter (04, 05, 06 og eldre).
--
-- Bygger på:
--   mv_siste_attest_per_enhet  siste attest per enhet og ordning (05). Enhetene vi teller.
--   v_attester                 alle attester (04). Brukes til antall attester og til å finne
--                              bygget en attest hører til.
--   byggeaar_kohort()          kohortgrensene (06). Grensene gjentas ikke her.
--
-- Personvern: funksjonene gir aldri bruksenhetsnummer, attestnummer eller enhet_id i utdata.
-- Alle tall er summer, andeler eller medianer over enheter.
--
-- VIKTIG: kjør   SELECT refresh_bygg_oversikt();   etter HVER import av attester.
-- Den oppdaterer alle viewene bak bygg-siden i riktig rekkefølge (se del 0b). Glemmes det, viser
-- bygg-siden tall fra forrige import, og funksjonene gir nok_data = false i stedet for feil tall
-- hvis viewene ikke lenger henger sammen.

-- ---------------------------------------------------------------------------------------------
-- 0. Materialiserte views (ytelse)
-- ---------------------------------------------------------------------------------------------
-- Målt uten dem: ~1-3 s per bygg-kall. To grunner:
--  (a) antall attester via v_attester tok 0,4-1 s, fordi viewet slår sammen to kilder og kobler mot
--      enova_raw (277k rader) ved hvert kall;
--  (b) "lignende" skannet og sorterte opptil 100k enheter (boligblokker) per ordning, to ganger.
DROP MATERIALIZED VIEW IF EXISTS mv_lignende_enheter;
DROP MATERIALIZED VIEW IF EXISTS mv_lignende_fordeling;
DROP MATERIALIZED VIEW IF EXISTS mv_attester_per_bygg;

-- Antall attester (ikke enheter) per bygg og ordning. Lite og fast: slås opp på bygningsnummer.
CREATE MATERIALIZED VIEW mv_attester_per_bygg AS
SELECT bygningsnummer, ordning, count(*)::int AS antall_attester
FROM v_attester
WHERE bygningsnummer IS NOT NULL
GROUP BY bygningsnummer, ordning;
CREATE UNIQUE INDEX ux_mv_attester_per_bygg ON mv_attester_per_bygg (bygningsnummer, ordning);

-- Fordelinger per gruppe: antall enheter, antall bygg og antall per karakter, på to nivåer:
--   niva 'kohort'   = (ordning, kategori, kohort)   -> trinn 1
--   niva 'kategori' = (ordning, kategori)           -> trinn 2 (reserve)
-- kohort er '' (tom tekst, ikke NULL) på kategorinivå, så oppslag og indekser slipper NULL-logikk.
-- Bygg uten gyldig byggeår har kohort NULL og er bare med på kategorinivå (CLAUDE.md).
-- "Lignende" skal utelate byggets egne enheter; det gjør funksjonene ved å trekke byggets egne
-- tall fra gruppetallene (telling er additiv, så resultatet er eksakt).
CREATE MATERIALIZED VIEW mv_lignende_fordeling AS
SELECT 'kohort'::text AS niva, m.ordning, m.bygningskategori AS kategori,
       byggeaar_kohort(m.byggeaar) AS kohort,
       count(*)::int AS n, count(DISTINCT m.bygningsnummer)::int AS n_bygg,
       count(m.energi_kwh_m2)::int AS n_kwh,
       count(*) FILTER (WHERE m.energikarakter = 'A')::int AS ka,
       count(*) FILTER (WHERE m.energikarakter = 'B')::int AS kb,
       count(*) FILTER (WHERE m.energikarakter = 'C')::int AS kc,
       count(*) FILTER (WHERE m.energikarakter = 'D')::int AS kd,
       count(*) FILTER (WHERE m.energikarakter = 'E')::int AS ke,
       count(*) FILTER (WHERE m.energikarakter = 'F')::int AS kf,
       count(*) FILTER (WHERE m.energikarakter = 'G')::int AS kg
FROM mv_siste_attest_per_enhet m
WHERE m.bygningskategori IS NOT NULL AND byggeaar_kohort(m.byggeaar) IS NOT NULL
GROUP BY m.ordning, m.bygningskategori, byggeaar_kohort(m.byggeaar)
UNION ALL
SELECT 'kategori', m.ordning, m.bygningskategori, '',
       count(*)::int, count(DISTINCT m.bygningsnummer)::int, count(m.energi_kwh_m2)::int,
       count(*) FILTER (WHERE m.energikarakter = 'A')::int, count(*) FILTER (WHERE m.energikarakter = 'B')::int,
       count(*) FILTER (WHERE m.energikarakter = 'C')::int, count(*) FILTER (WHERE m.energikarakter = 'D')::int,
       count(*) FILTER (WHERE m.energikarakter = 'E')::int, count(*) FILTER (WHERE m.energikarakter = 'F')::int,
       count(*) FILTER (WHERE m.energikarakter = 'G')::int
FROM mv_siste_attest_per_enhet m
WHERE m.bygningskategori IS NOT NULL
GROUP BY m.ordning, m.bygningskategori;
CREATE UNIQUE INDEX ux_mv_lignende_fordeling ON mv_lignende_fordeling (niva, ordning, kategori, kohort);

-- Enheter med kWh-verdi, sortert og nummerert (rang) innenfor hver gruppe, på begge nivåer.
-- Hvorfor: medianen for "lignende uten byggets egne enheter" kan ikke trekkes fra en forhåndsberegnet
-- median. Men med rangene kan vi slå opp elementene rundt midten direkte (indeks, mikrosekunder)
-- i stedet for å sortere 100k verdier ved hvert kall: finn midtposisjonen i gruppen UTEN byggets
-- egne enheter ved å hoppe over byggets egne rang-numre (se bygg_lignende_json).
-- Rang er row_number() sortert på kWh, så enhet_id som tie-break gir en fast rekkefølge.
CREATE MATERIALIZED VIEW mv_lignende_enheter AS
SELECT 'kohort'::text AS niva, m.ordning, m.bygningskategori AS kategori,
       byggeaar_kohort(m.byggeaar) AS kohort, m.bygningsnummer, m.energi_kwh_m2 AS kwh,
       (row_number() OVER (PARTITION BY m.ordning, m.bygningskategori, byggeaar_kohort(m.byggeaar)
                           ORDER BY m.energi_kwh_m2, m.enhet_id))::int AS rang
FROM mv_siste_attest_per_enhet m
WHERE m.bygningskategori IS NOT NULL AND byggeaar_kohort(m.byggeaar) IS NOT NULL
  AND m.energi_kwh_m2 IS NOT NULL
UNION ALL
SELECT 'kategori', m.ordning, m.bygningskategori, '', m.bygningsnummer, m.energi_kwh_m2,
       (row_number() OVER (PARTITION BY m.ordning, m.bygningskategori ORDER BY m.energi_kwh_m2, m.enhet_id))::int
FROM mv_siste_attest_per_enhet m
WHERE m.bygningskategori IS NOT NULL AND m.energi_kwh_m2 IS NOT NULL;
-- Slå opp element nr. N i en gruppe:
CREATE UNIQUE INDEX ux_mv_lignende_enheter_rang ON mv_lignende_enheter (niva, ordning, kategori, kohort, rang);
-- Finn siste element med kWh <= en verdi (til "andel som bruker mer"); rang som siste nøkkel gir
-- høyeste rang blant like verdier:
CREATE INDEX ix_mv_lignende_enheter_kwh ON mv_lignende_enheter (niva, ordning, kategori, kohort, kwh, rang);
-- Byggets egne rader i en gruppe:
CREATE INDEX ix_mv_lignende_enheter_bygg ON mv_lignende_enheter (bygningsnummer, ordning);

ANALYZE mv_attester_per_bygg;
ANALYZE mv_lignende_fordeling;
ANALYZE mv_lignende_enheter;

-- ---------------------------------------------------------------------------------------------
-- 0b. refresh_bygg_oversikt: oppdater alle views bak bygg-siden i riktig rekkefølge
-- ---------------------------------------------------------------------------------------------
-- Rekkefølgen er viktig: de tre andre viewene er bygget på mv_siste_attest_per_enhet, og
-- mv_lignende_enheter må være i takt med mv_lignende_fordeling (rangene må passe til tellingene).
-- Returnerer en kort tekst med radantall, så den som kjører den ser at det ble gjort.
CREATE OR REPLACE FUNCTION refresh_bygg_oversikt()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_ut text := '';
    v_navn text;
    v_n bigint;
BEGIN
    FOREACH v_navn IN ARRAY ARRAY['mv_siste_attest_per_enhet', 'mv_attester_per_bygg',
                                  'mv_lignende_fordeling', 'mv_lignende_enheter'] LOOP
        EXECUTE format('REFRESH MATERIALIZED VIEW %I', v_navn);
        EXECUTE format('SELECT count(*) FROM %I', v_navn) INTO v_n;
        v_ut := v_ut || CASE WHEN v_ut = '' THEN '' ELSE ', ' END || v_navn || ': ' || v_n || ' rader';
    END LOOP;
    RETURN v_ut;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 1. bygg_fra_attest: hvilket bygg hører attesten til?
-- ---------------------------------------------------------------------------------------------
-- Brukes når noen kommer inn med et attestnummer (f.eks. fra kartpopupen). Vi søker i v_attester
-- og ikke i mv_siste_attest_per_enhet, fordi en eldre attest (ikke siste for enheten) også skal
-- finne bygget sitt. NULL hvis ukjent eller hvis attesten mangler bygningsnummer; API-et gjør
-- NULL til 404.
CREATE OR REPLACE FUNCTION bygg_fra_attest(p_attestnummer text)
RETURNS json
LANGUAGE sql
STABLE
AS $$
    SELECT json_build_object('bygningsnummer', a.bygningsnummer)
    FROM v_attester a
    WHERE a.attestnummer = btrim(p_attestnummer)
      AND a.bygningsnummer IS NOT NULL
    LIMIT 1
$$;

-- ---------------------------------------------------------------------------------------------
-- 2a. bygg_lignende_grunnlag: gruppen "lignende enheter" uten byggets egne enheter
-- ---------------------------------------------------------------------------------------------
-- Gruppetall fra mv_lignende_fordeling minus byggets egne enheter som hører til gruppen
-- (samme ordning, kategori og, på kohortnivå, samme kohort pr. enhet). Ingen rader = gruppen finnes ikke.
-- DROP først: returtypen (kolonnene) kan ikke endres med CREATE OR REPLACE. Funksjonen er vår egen.
DROP FUNCTION IF EXISTS bygg_lignende_grunnlag(text, text, text, text, text);
CREATE OR REPLACE FUNCTION bygg_lignende_grunnlag(
    p_bygningsnummer text, p_ordning text, p_kategori text, p_niva text, p_kohort text)
RETURNS TABLE (n int, n_bygg int, n_kwh int, ant int[], eier_kwh int)
LANGUAGE sql
STABLE
AS $$
    SELECT g.n - o.n,
           g.n_bygg - (o.n > 0)::int,
           g.n_kwh - o.n_kwh,
           ARRAY[g.ka - o.ka, g.kb - o.kb, g.kc - o.kc, g.kd - o.kd, g.ke - o.ke, g.kf - o.kf, g.kg - o.kg],
           o.n_kwh   -- byggets egne enheter med kWh, til kontroll mot mv_lignende_enheter
    FROM mv_lignende_fordeling g
    CROSS JOIN LATERAL (
        SELECT count(*)::int AS n, count(m.energi_kwh_m2)::int AS n_kwh,
               count(*) FILTER (WHERE m.energikarakter = 'A')::int AS ka,
               count(*) FILTER (WHERE m.energikarakter = 'B')::int AS kb,
               count(*) FILTER (WHERE m.energikarakter = 'C')::int AS kc,
               count(*) FILTER (WHERE m.energikarakter = 'D')::int AS kd,
               count(*) FILTER (WHERE m.energikarakter = 'E')::int AS ke,
               count(*) FILTER (WHERE m.energikarakter = 'F')::int AS kf,
               count(*) FILTER (WHERE m.energikarakter = 'G')::int AS kg
        FROM mv_siste_attest_per_enhet m
        WHERE m.bygningsnummer = p_bygningsnummer AND m.ordning = p_ordning
          AND m.bygningskategori = p_kategori
          AND (p_niva = 'kategori' OR byggeaar_kohort(m.byggeaar) = p_kohort)
    ) o
    WHERE g.niva = p_niva AND g.ordning = p_ordning AND g.kategori = p_kategori
      AND g.kohort = CASE WHEN p_niva = 'kohort' THEN p_kohort ELSE '' END
$$;

-- ---------------------------------------------------------------------------------------------
-- 2b. bygg_lignende_json: sammenligning med lignende bygg for ÉN ordning (hjelpefunksjon)
-- ---------------------------------------------------------------------------------------------
-- Regler (CLAUDE.md + beslutninger.md 2026-11-16):
--  * Lignende = enheter i ANDRE bygg (bygningsnummer er ulikt) i SAMME ordning. Å ta med byggets
--    egne enheter ville sammenlignet bygget med seg selv, og ordningene må aldri blandes.
--  * Trinn 1: samme kategori og kohort. Trinn 2 (reserve): bare samme kategori, brukt hvis
--    trinn 1 har under 10 enheter eller bygget mangler kohort.
--  * nok_data = antall enheter i grunnlaget som ble brukt >= 10. Hvis ikke, er alle
--    sammenligningstall NULL, slik at grensesnittet ikke kan vise et tall på for tynt grunnlag.
CREATE OR REPLACE FUNCTION bygg_lignende_json(
    p_bygningsnummer text,     -- bygget som sammenlignes (ekskluderes fra grunnlaget)
    p_ordning        text,     -- 'gammel' eller 'ny'
    p_kategori       text,     -- byggets kategori (NULL = ukjent)
    p_kohort         text,     -- byggets kohort (NULL = ukjent byggeår)
    p_bygg_median    numeric   -- byggets publiserte (avrundede) median, kan være NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    c_minimum   CONSTANT int := 10;      -- samme tall som "minimum_lignende" i toppnivået
    c_min_bygg  CONSTANT int := 3;       -- minst så mange enheter i bygget for andel_enheter_bedre
    v_niva      text;
    v_grunnlag  text;
    v_n         int := 0;
    v_n_bygg    int := 0;
    v_n_kwh     int := 0;
    v_eier_kwh  int := 0;
    v_ant       int[];
    v_andeler   numeric[];
    v_eier      int[];                   -- byggets egne rang-numre i gruppen, stigende
    v_kohortnokkel text;
    v_m         int;                     -- antall kWh-verdier i gruppen uten byggets egne
    v_f         float8;
    v_lo        int;
    v_hi        int;
    v_v_lo      numeric;
    v_v_hi      numeric;
    v_median    numeric;
    v_hoyere    numeric;
    v_siste_le  int;
    v_eier_hoy  int;
    v_bygg_n    int;
    v_bygg_lavere int;
    v_antall_bedre int;
    v_antall_energitall int;
    v_bedre     numeric;
    v_sum       numeric;
    v_maks      int := 1;
    i           int;
BEGIN
    -- Ukjent kategori: ingen sammenligning er mulig (og vi gjetter ikke).
    IF p_kategori IS NULL THEN
        RETURN json_build_object(
            'grunnlag', NULL, 'antall_enheter', 0, 'antall_bygg', 0, 'nok_data', false,
            'karakterfordeling', NULL, 'median_kwh_m2', NULL,
            'andel_med_hoyere_energibruk', NULL, 'andel_enheter_bedre_enn_lignende', NULL,
            'antall_enheter_bedre_enn_lignende', NULL, 'antall_enheter_med_energitall', NULL);
    END IF;

    -- Trinn 1 (kategori + kohort), hvis bygget har kohort og gruppen har nok enheter.
    v_niva := 'kategori';
    IF p_kohort IS NOT NULL THEN
        SELECT g.n INTO v_n FROM bygg_lignende_grunnlag(p_bygningsnummer, p_ordning, p_kategori, 'kohort', p_kohort) g;
        IF COALESCE(v_n, 0) >= c_minimum THEN v_niva := 'kohort'; END IF;
    END IF;
    -- Trinn 2 (reserve) ellers.
    SELECT g.n, g.n_bygg, g.n_kwh, g.ant, g.eier_kwh INTO v_n, v_n_bygg, v_n_kwh, v_ant, v_eier_kwh
    FROM bygg_lignende_grunnlag(p_bygningsnummer, p_ordning, p_kategori, v_niva, p_kohort) g;
    v_n := COALESCE(v_n, 0); v_n_bygg := COALESCE(v_n_bygg, 0); v_n_kwh := COALESCE(v_n_kwh, 0);
    v_grunnlag := CASE v_niva WHEN 'kohort' THEN 'kategori og byggeår' ELSE 'bare kategori' END;

    -- Vakt 1: negative tall betyr at mv_lignende_fordeling ikke er i takt med
    -- mv_siste_attest_per_enhet (byggets egne enheter er trukket fra en gruppe de ikke var talt i).
    -- Da gir vi nok_data = false og ingen tall. Løsning: SELECT refresh_bygg_oversikt();
    IF v_n < 0 OR v_n_bygg < 0 OR v_n_kwh < 0 OR EXISTS (SELECT 1 FROM unnest(v_ant) a WHERE a < 0) THEN
        RETURN json_build_object(
            'grunnlag', v_grunnlag, 'antall_enheter', GREATEST(v_n, 0), 'antall_bygg', GREATEST(v_n_bygg, 0),
            'nok_data', false,
            'karakterfordeling', NULL, 'median_kwh_m2', NULL,
            'andel_med_hoyere_energibruk', NULL, 'andel_enheter_bedre_enn_lignende', NULL,
            'antall_enheter_bedre_enn_lignende', NULL, 'antall_enheter_med_energitall', NULL);
    END IF;

    IF v_n < c_minimum THEN
        RETURN json_build_object(
            'grunnlag', v_grunnlag, 'antall_enheter', v_n, 'antall_bygg', v_n_bygg, 'nok_data', false,
            'karakterfordeling', NULL, 'median_kwh_m2', NULL,
            'andel_med_hoyere_energibruk', NULL, 'andel_enheter_bedre_enn_lignende', NULL,
            'antall_enheter_bedre_enn_lignende', NULL, 'antall_enheter_med_energitall', NULL);
    END IF;

    -- Karakterfordeling som andeler avrundet til tre desimaler. Avrunding hver for seg kan gi sum
    -- 0,999 eller 1,001, men kontrakten sier "summerer til 1": avviket (maks 0,003) legges på den
    -- største andelen, der det betyr minst.
    v_andeler := ARRAY(SELECT round(a::numeric / v_n, 3) FROM unnest(v_ant) AS a);
    v_sum := 0;
    FOR i IN 1..7 LOOP
        v_sum := v_sum + v_andeler[i];
        IF v_ant[i] > v_ant[v_maks] THEN v_maks := i; END IF;
    END LOOP;
    v_andeler[v_maks] := v_andeler[v_maks] + (1 - v_sum);

    -- Median uten byggets egne enheter, via rang (se mv_lignende_enheter).
    -- Gruppen er sortert på kWh med rang 1..N. Byggets egne enheter har noen av disse rangene (v_eier).
    -- Element nr. r av "gruppen uten bygget" ligger på posisjon p der p - (antall egne rang <= p) = r.
    -- Vi finner den minste slike p ved å starte på r og flytte oss forbi egne rang til det stabiliserer seg.
    v_kohortnokkel := CASE WHEN v_niva = 'kohort' THEN p_kohort ELSE '' END;
    SELECT COALESCE(array_agg(e.rang ORDER BY e.rang), ARRAY[]::int[]) INTO v_eier
    FROM mv_lignende_enheter e
    WHERE e.bygningsnummer = p_bygningsnummer AND e.ordning = p_ordning AND e.niva = v_niva
      AND e.kategori = p_kategori AND e.kohort = v_kohortnokkel;

    -- Vakt 1b: byggets egne enheter med kWh i mv_siste_attest_per_enhet skal være like mange som
    -- byggets rader i mv_lignende_enheter. Er de ikke det, er viewene ute av takt (f.eks. ny
    -- import uten refresh), og subtraksjonen over gir feil tall uten å bli negativ.
    IF COALESCE(array_length(v_eier, 1), 0) <> v_eier_kwh THEN
        RETURN json_build_object(
            'grunnlag', v_grunnlag, 'antall_enheter', v_n, 'antall_bygg', v_n_bygg, 'nok_data', false,
            'karakterfordeling', NULL, 'median_kwh_m2', NULL,
            'andel_med_hoyere_energibruk', NULL, 'andel_enheter_bedre_enn_lignende', NULL,
            'antall_enheter_bedre_enn_lignende', NULL, 'antall_enheter_med_energitall', NULL);
    END IF;

    v_m := v_n_kwh;   -- allerede uten byggets egne (fordelingstall minus egne)
    IF v_m > 0 THEN
        -- Samme definisjon som percentile_cont(0.5): posisjon f = 0.5*(m-1), lineær interpolasjon.
        v_f  := 0.5 * (v_m - 1);
        v_lo := floor(v_f)::int + 1;
        v_hi := ceil(v_f)::int + 1;
        FOR i IN 1..2 LOOP
            DECLARE
                r int := CASE i WHEN 1 THEN v_lo ELSE v_hi END;
                p int := CASE i WHEN 1 THEN v_lo ELSE v_hi END;
                j int;
            BEGIN
                LOOP
                    SELECT count(*) INTO j FROM unnest(v_eier) x WHERE x <= p;
                    EXIT WHEN r + j = p;
                    p := r + j;
                END LOOP;
                IF i = 1 THEN
                    SELECT e.kwh INTO v_v_lo FROM mv_lignende_enheter e
                    WHERE e.niva = v_niva AND e.ordning = p_ordning AND e.kategori = p_kategori
                      AND e.kohort = v_kohortnokkel AND e.rang = p;
                ELSE
                    SELECT e.kwh INTO v_v_hi FROM mv_lignende_enheter e
                    WHERE e.niva = v_niva AND e.ordning = p_ordning AND e.kategori = p_kategori
                      AND e.kohort = v_kohortnokkel AND e.rang = p;
                END IF;
            END;
        END LOOP;
        v_median := round((v_v_lo::float8 + (v_f - floor(v_f)) * (v_v_hi::float8 - v_v_lo::float8))::numeric, 1);
    END IF;

    -- Andel av lignende som bruker MER enn byggets median: (alle i gruppen over) minus (byggets egne over).
    -- Gruppen er sortert, så antallet over medianverdien er "gruppestørrelse minus rang til siste
    -- element <= verdien", som er ett indeksoppslag.
    IF p_bygg_median IS NOT NULL AND v_m > 0 THEN
        SELECT COALESCE(max(x.rang), 0) INTO v_siste_le FROM (
            SELECT e.rang FROM mv_lignende_enheter e
            WHERE e.niva = v_niva AND e.ordning = p_ordning AND e.kategori = p_kategori
              AND e.kohort = v_kohortnokkel AND e.kwh <= p_bygg_median
            ORDER BY e.kwh DESC, e.rang DESC LIMIT 1) x;
        SELECT count(*) INTO v_eier_hoy FROM mv_lignende_enheter e
        WHERE e.bygningsnummer = p_bygningsnummer AND e.ordning = p_ordning AND e.niva = v_niva
          AND e.kategori = p_kategori AND e.kohort = v_kohortnokkel AND e.kwh > p_bygg_median;
        v_hoyere := round(((v_n_kwh + COALESCE(array_length(v_eier, 1), 0) - v_siste_le - v_eier_hoy)::numeric) / v_m, 3);
    END IF;

    -- Vakt 2: views ute av takt gir rang som ikke finnes (median mangler selv om gruppen har
    -- kWh-verdier) eller en andel utenfor 0-1. Da viser vi heller ingen tall enn feil tall.
    IF (v_m > 0 AND (v_v_lo IS NULL OR v_v_hi IS NULL OR v_median IS NULL))
       OR v_hoyere < 0 OR v_hoyere > 1 THEN
        RETURN json_build_object(
            'grunnlag', v_grunnlag, 'antall_enheter', v_n, 'antall_bygg', v_n_bygg, 'nok_data', false,
            'karakterfordeling', NULL, 'median_kwh_m2', NULL,
            'andel_med_hoyere_energibruk', NULL, 'andel_enheter_bedre_enn_lignende', NULL,
            'antall_enheter_bedre_enn_lignende', NULL, 'antall_enheter_med_energitall', NULL);
    END IF;

    -- Spredning i bygget: andel av byggets egne enheter som bruker mindre enn lignende-medianen.
    -- Bare for bygg med minst 3 enheter i ordningen, så tallet ikke i praksis beskriver én bolig.
    -- Grensen gjelder enheter MED energitall (v_bygg_n), siden det er dem andelen regnes over.
    SELECT count(m.energi_kwh_m2), count(*) FILTER (WHERE m.energi_kwh_m2 < v_median)
    INTO v_bygg_n, v_bygg_lavere
    FROM mv_siste_attest_per_enhet m
    WHERE m.ordning = p_ordning AND m.bygningsnummer = p_bygningsnummer;
    IF v_bygg_n >= c_min_bygg AND v_median IS NOT NULL THEN
        v_bedre := round(v_bygg_lavere::numeric / v_bygg_n, 3);
        v_antall_bedre := v_bygg_lavere;
        v_antall_energitall := v_bygg_n;
    END IF;

    RETURN json_build_object(
        'grunnlag', v_grunnlag,
        'antall_enheter', v_n,
        'antall_bygg', v_n_bygg,
        'nok_data', true,
        'karakterfordeling', json_build_object(
            'A', v_andeler[1], 'B', v_andeler[2], 'C', v_andeler[3], 'D', v_andeler[4],
            'E', v_andeler[5], 'F', v_andeler[6], 'G', v_andeler[7]),
        'median_kwh_m2', v_median,
        'andel_med_hoyere_energibruk', v_hoyere,
        'andel_enheter_bedre_enn_lignende', v_bedre,
        'antall_enheter_bedre_enn_lignende', v_antall_bedre,
        'antall_enheter_med_energitall', v_antall_energitall);
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. bygg_oversikt_json: alt bygg-siden trenger for ett bygg
-- ---------------------------------------------------------------------------------------------
-- NULL hvis bygget ikke har attester (API-et gjør det til 404).
CREATE OR REPLACE FUNCTION bygg_oversikt_json(p_bygningsnummer text)
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_bygg    text := btrim(p_bygningsnummer);
    v_kat     text;
    v_aar     int;
    v_kohort  text;
    v_adresser json;
    v_ordninger json;
BEGIN
    -- Byggets kategori og byggeår: fra bygget sin SISTE attest (høyeste utstedelsestidspunkt,
    -- attestnummer som tie-break, som i mv_siste_attest_per_enhet). Attestene i et bygg er ikke
    -- alltid enige (målt: kategori ulik innen 383 av 18 183 bygg, byggeår innen 2 302; typisk
    -- 2 års forskjell, men opp til 185). Vi velger siste attest fordi den er nyest og vi trenger
    -- ÉN verdi som både sammenligning og visning kan bruke; en avstemming enhet for enhet ville
    -- gitt bygget flere kohorter samtidig. Merk: siste attest kan være ny ordning, så kategori og
    -- kohort er felles for begge ordninger i samme bygg.
    SELECT m.bygningskategori, m.byggeaar
    INTO v_kat, v_aar
    FROM mv_siste_attest_per_enhet m
    WHERE m.bygningsnummer = v_bygg
    ORDER BY m.utstedt_tidspunkt DESC, m.attestnummer DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_kohort := byggeaar_kohort(v_aar);   -- NULL hvis byggeår mangler/ugyldig: ingen kohort

    -- Innganger: alle adresser i bygget, sortert (adresser er ikke personopplysninger i seg selv,
    -- men bruksenhetsnummer og attestnummer holdes utenfor).
    SELECT COALESCE(json_agg(a ORDER BY a), '[]'::json) INTO v_adresser
    FROM (SELECT DISTINCT btrim(m.adresse) AS a
          FROM mv_siste_attest_per_enhet m
          WHERE m.bygningsnummer = v_bygg AND NULLIF(btrim(m.adresse), '') IS NOT NULL) s;

    -- Én rad per ordning. Ordningene aggregeres hver for seg (GROUP BY ordning), aldri sammen.
    SELECT COALESCE(json_agg(o.rad ORDER BY o.sortering), '[]'::json) INTO v_ordninger
    FROM (
        SELECT
            CASE g.ordning WHEN 'gammel' THEN 1 ELSE 2 END AS sortering,
            json_build_object(
                'ordning', g.ordning,
                -- Periode fra faktisk min/maks utstedelsesdato blant attestene statistikken bygger på.
                'periode', CASE
                    WHEN extract(year FROM g.d_min) = extract(year FROM g.d_maks)
                        THEN 'attester utstedt i ' || extract(year FROM g.d_min)::int
                    ELSE 'attester utstedt ' || extract(year FROM g.d_min)::int
                         || '–' || extract(year FROM g.d_maks)::int
                END,
                'antall_enheter', g.n,
                -- Alle attester (ikke bare siste per enhet), forhåndstelt fra v_attester i
                -- mv_attester_per_bygg (se del 0).
                'antall_attester', (SELECT a.antall_attester FROM mv_attester_per_bygg a
                                    WHERE a.bygningsnummer = v_bygg AND a.ordning = g.ordning),
                'karakterfordeling', json_build_object(
                    'A', g.ka, 'B', g.kb, 'C', g.kc, 'D', g.kd, 'E', g.ke, 'F', g.kf, 'G', g.kg),
                'median_kwh_m2', g.median,
                -- Ny ordning har ikke oppvarmingskarakter: hele feltet er NULL, ikke nuller.
                'oppvarmingsfordeling', CASE WHEN g.ordning = 'gammel' THEN json_build_object(
                    'Green', g.o_green, 'LightGreen', g.o_lightgreen, 'Yellow', g.o_yellow,
                    'Orange', g.o_orange, 'Red', g.o_red) END,
                'lignende', bygg_lignende_json(v_bygg, g.ordning, v_kat, v_kohort, g.median)
            ) AS rad
        FROM (
            SELECT
                m.ordning,
                count(*)::int AS n,
                min(m.utstedelsesdato) AS d_min,
                max(m.utstedelsesdato) AS d_maks,
                count(*) FILTER (WHERE m.energikarakter = 'A')::int AS ka,
                count(*) FILTER (WHERE m.energikarakter = 'B')::int AS kb,
                count(*) FILTER (WHERE m.energikarakter = 'C')::int AS kc,
                count(*) FILTER (WHERE m.energikarakter = 'D')::int AS kd,
                count(*) FILTER (WHERE m.energikarakter = 'E')::int AS ke,
                count(*) FILTER (WHERE m.energikarakter = 'F')::int AS kf,
                count(*) FILTER (WHERE m.energikarakter = 'G')::int AS kg,
                round((percentile_cont(0.5) WITHIN GROUP (ORDER BY m.energi_kwh_m2::float8))::numeric, 1) AS median,
                count(*) FILTER (WHERE m.oppvarmingskarakter = 'Green')::int      AS o_green,
                count(*) FILTER (WHERE m.oppvarmingskarakter = 'LightGreen')::int AS o_lightgreen,
                count(*) FILTER (WHERE m.oppvarmingskarakter = 'Yellow')::int     AS o_yellow,
                count(*) FILTER (WHERE m.oppvarmingskarakter = 'Orange')::int     AS o_orange,
                count(*) FILTER (WHERE m.oppvarmingskarakter = 'Red')::int        AS o_red
            FROM mv_siste_attest_per_enhet m
            WHERE m.bygningsnummer = v_bygg
            GROUP BY m.ordning
        ) g
    ) o;

    RETURN json_build_object(
        'bygningsnummer', v_bygg,
        'adresser', v_adresser,
        'bygningskategori', v_kat,
        -- Null når byggeåret er ugyldig (kohort er da null: mangler, 0 eller før 1800).
        'byggeaar', CASE WHEN v_kohort IS NOT NULL THEN v_aar END,
        'kohort', v_kohort,
        'minimum_lignende', 10,
        'ordninger', v_ordninger);
END
$$;

COMMENT ON FUNCTION bygg_fra_attest(text) IS
  'Bygningsnummer for et attestnummer som json, eller NULL (API: 404). Se docs/api-kontrakt.md.';
COMMENT ON FUNCTION bygg_lignende_json(text, text, text, text, numeric) IS
  'Hjelpefunksjon for bygg_oversikt_json: lignende-bygg-objektet for én ordning (trinn 1 / reserve, min. 10 enheter).';
COMMENT ON FUNCTION bygg_oversikt_json(text) IS
  'Bygg-oversikten som json etter docs/api-kontrakt.md, eller NULL hvis bygget ikke har attester.';
