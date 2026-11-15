-- 06_kohort.sql
-- Byggeårskohort. Dette er det ENESTE stedet kohortgrensene står (CLAUDE.md); SQL og frontend
-- skal hente kohortnavnet herfra og ikke lage egne grenser.
-- Grensene følger byggtekniske forskrifter (eierens beslutning 2026-11-15).
-- IMMUTABLE: samme input gir alltid samme svar, så Postgres kan bruke funksjonen i indekser
-- og forhåndsberegne den. Endres grensene, må indekser som bruker den bygges på nytt.
-- Ugyldig år (NULL, 0 eller før 1800) gir NULL: bygget havner ikke i noen kohort.
-- Kohortnavnene bruker tankestrek (–), som i CLAUDE.md.

CREATE OR REPLACE FUNCTION byggeaar_kohort(aar int)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN aar IS NULL OR aar < 1800 THEN NULL
        WHEN aar < 1949  THEN 'før 1949'
        WHEN aar <= 1969 THEN '1949–1969'
        WHEN aar <= 1986 THEN '1970–1986'
        WHEN aar <= 1996 THEN '1987–1996'
        WHEN aar <= 2006 THEN '1997–2006'
        WHEN aar <= 2016 THEN '2007–2016'
        ELSE '2017 og senere'
    END
$$;
