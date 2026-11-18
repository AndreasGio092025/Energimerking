-- 05_siste_attest_per_enhet.sql
-- Siste attest per enhet og ordning. Statistikk skal telle enheter, ikke attester (CLAUDE.md),
-- og gammel/ny ordning skal ikke blandes, så vi tar siste attest per (enhet_id, ordning).
-- En enhet med både 2025- og 2026-attest får to rader her, en per ordning; det er grunnlaget
-- for en senere overgangsnøkkel.
--
-- Hvorfor DISTINCT ON og ikke row_number() = 1: samme resultat, men kortere, og Postgres
-- sorterer én gang og beholder første rad per gruppe. Sorteringen er deterministisk:
-- nyeste tidspunkt først, og attestnummer som siste tie-break, så to kjøringer gir lik fasit.
--
-- Hvorfor materialisert: v_attester slår sammen 126k + 18k rader og slår opp i enova_raw
-- (277k rader). Det vil vi ikke gjøre ved hver forespørsel. Oppdater etter ny import:
--   REFRESH MATERIALIZED VIEW mv_siste_attest_per_enhet;
-- Rekkefølge og kjøring på nytt: 05 må kjøres før 07 og 08, som bygger på dette viewet.
-- Mot en tom database går det av seg selv (00-09 kjøres i navnerekkefølge ved første oppstart).
-- Mot en database der 07 og 08 allerede er installert FEILER DROP nedenfor (uten CASCADE), fordi
-- mv_lignende_fordeling, mv_lignende_enheter og mv_enhet_punkt (og mv_enhet_punkt_oversikt under
-- den) er bygget på viewet. Da må de droppes først:
--   DROP MATERIALIZED VIEW IF EXISTS mv_enhet_punkt_oversikt, mv_enhet_punkt,
--       mv_lignende_enheter, mv_lignende_fordeling;
-- og deretter kjøres 05, 07 og 08 på nytt i den rekkefølgen. (07 og 08 dropper og bygger sine
-- egne views selv.) Funksjonene i 07/08 er uberørt av DROP og lages på nytt av filene.

DROP MATERIALIZED VIEW IF EXISTS mv_siste_attest_per_enhet;

CREATE MATERIALIZED VIEW mv_siste_attest_per_enhet AS
SELECT DISTINCT ON (enhet_id, ordning)
    enhet_id,
    ordning,
    attestnummer,
    utstedelsesdato,
    utstedt_tidspunkt,
    bygningsnummer,
    bruksenhetsnummer,
    adresse,
    bygningskategori,
    byggeaar,
    energikarakter,
    oppvarmingskarakter,
    energi_kwh_m2,
    kilde
FROM v_attester
-- Attester uten bygningsnummer har enhet_id NULL; uten filter ville de blitt slått sammen til én "enhet".
WHERE enhet_id IS NOT NULL
ORDER BY enhet_id, ordning, utstedt_tidspunkt DESC, attestnummer DESC;

-- UNIQUE slik at REFRESH ... CONCURRENTLY kan brukes mens appen leser.
CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_siste_attest_enhet_ordning
    ON mv_siste_attest_per_enhet (enhet_id, ordning);
-- Bygningsnummer: slå opp alle enheter i et bygg.
CREATE INDEX IF NOT EXISTS idx_mv_siste_attest_bygningsnummer
    ON mv_siste_attest_per_enhet (bygningsnummer);
