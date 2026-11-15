-- 04_attester.sql
-- Felles datagrunnlag: én rad per energiattest i Oslo, fra begge kilder, med like kolonner.
-- Alt som regner statistikk skal gå via dette viewet (eller materialiserte views bygget på det),
-- slik at reglene for enhet, ordning og byggeår står ett sted og ikke gjentas i hver spørring.
-- Kan kjøres på nytt (CREATE OR REPLACE VIEW). Rører ingen eksisterende objekter.
--
-- Kilder:
--   2025: denorm_matrikkel_og_enova_oslo (én rad per attest, Oslo). Den mangler bygningsnummer
--         og bygningskategori, så de hentes fra enova_raw (rå Enova-fil), koblet på attestnummer
--         (enova_raw.col19 = attestNr, primærnøkkel). Hvorfor ikke tabellen energimerke? Den har
--         bare bygningsnummer, mangler 654 av attestene, og gir ellers samme verdier som enova_raw
--         (0 avvik testet). enova_raw har dessuten bygningskategori.
--         enova_raw-kolonner: col7 = bygningsnummer, col13 = bygningskategori, col19 = attestnummer.
--   2026: energiattester (hele landet, alle kolonner tekst), filtrert på knr = '0301' (Oslo).

CREATE OR REPLACE VIEW v_attester AS
WITH kilde_2025 AS (
    SELECT
        d."attestNr"                              AS attestnummer,
        d."utstedelsesDato"                       AS utstedt_tidspunkt,
        NULLIF(btrim(r.col7), '')                 AS bygningsnummer,
        NULLIF(btrim(d."bruksenhetsNr"), '')      AS bruksenhetsnummer,
        d.adresse                                 AS adresse,
        NULLIF(btrim(r.col13), '')                AS bygningskategori,
        d."byggeår"::int                          AS byggeaar_raa,
        d.energikarakter                          AS energikarakter,
        d.oppvarmingskarakter                     AS oppvarming_raa,
        d."beregnetLevertEnergiTotaltkWhm2"       AS kwh_tekst,
        '2025-denorm'::text                       AS kilde
    FROM denorm_matrikkel_og_enova_oslo d
    LEFT JOIN enova_raw r ON r.col19 = d."attestNr"
),
kilde_2026 AS (
    SELECT
        a.attestnummer,
        -- Datoen er tekst med klokkeslett ('2026-07-15T19:06:21.0000000'); ::timestamp tåler det.
        a.utstedelsesdato::timestamp              AS utstedt_tidspunkt,
        NULLIF(btrim(a.bygningsnummer), '')       AS bygningsnummer,
        NULLIF(btrim(a.bruksenhetsnummer), '')    AS bruksenhetsnummer,
        a.gateadresse                             AS adresse,
        NULLIF(btrim(a.bygningskategori), '')     AS bygningskategori,
        -- Regex-vakt: tekst som ikke er et heltall skal bli NULL, ikke stoppe hele viewet.
        CASE WHEN a.byggear ~ '^\d{1,4}$' THEN a.byggear::int END AS byggeaar_raa,
        a.energikarakter                          AS energikarakter,
        NULL::text                                AS oppvarming_raa,  -- ny ordning har ikke oppvarmingskarakter
        a.beregnetlevertenergitotaltkwhm2         AS kwh_tekst,
        '2026-energiattester'::text               AS kilde
    FROM energiattester a
    WHERE a.knr = '0301'
),
samlet AS (
    SELECT * FROM kilde_2025
    UNION ALL
    SELECT * FROM kilde_2026
)
SELECT
    s.attestnummer,
    -- Ordning avgjøres av utstedelsesdato (eierens beslutning 2026-11-15), ikke av kildetabellen.
    CASE WHEN s.utstedt_tidspunkt < TIMESTAMP '2026-01-01' THEN 'gammel' ELSE 'ny' END AS ordning,
    s.utstedt_tidspunkt::date                     AS utstedelsesdato,
    -- Fullt tidsstempel beholdes bare for å kunne velge "siste" attest når to har samme dato.
    s.utstedt_tidspunkt                           AS utstedt_tidspunkt,
    s.bygningsnummer,
    s.bruksenhetsnummer,
    -- Enhet = bruksenhet. Uten bruksenhetsnummer brukes bare bygningsnummer. Uten bygningsnummer
    -- kan vi ikke identifisere enheten, så enhet_id blir NULL (og attesten telles ikke som enhet).
    CASE
        WHEN s.bygningsnummer IS NULL THEN NULL
        WHEN s.bruksenhetsnummer IS NULL THEN s.bygningsnummer
        ELSE s.bygningsnummer || '-' || s.bruksenhetsnummer
    END                                           AS enhet_id,
    s.adresse,
    s.bygningskategori,
    -- 0 og år før 1800 betyr "ukjent" i dataene. NULL gjør at byggeaar_kohort() også gir NULL.
    CASE WHEN s.byggeaar_raa >= 1800 THEN s.byggeaar_raa END AS byggeaar,
    s.energikarakter,
    -- Dataene har 'Lightgreen', oppslagstabellen 'LightGreen'. Vi kobler på lower() og returnerer
    -- oppslagstabellens skrivemåte, så verdien passer mot oppslagstabellen.
    ok.kode                                       AS oppvarmingskarakter,
    -- Tall i tekstkolonner kan ha komma som desimaltegn; vi bytter til punktum og vokter med regex.
    CASE WHEN replace(s.kwh_tekst, ',', '.') ~ '^\d+(\.\d+)?$'
         THEN replace(s.kwh_tekst, ',', '.')::numeric END AS energi_kwh_m2,
    s.kilde
FROM samlet s
LEFT JOIN oppvarmingskarakter ok ON lower(ok.kode) = lower(s.oppvarming_raa);

COMMENT ON VIEW v_attester IS
  'Én rad per Oslo-attest fra 2025-denorm og 2026-energiattester. enhet_id = bygningsnummer[-bruksenhetsnummer]; ordning fra utstedelsesdato.';
