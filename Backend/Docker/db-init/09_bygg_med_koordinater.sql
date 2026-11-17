-- 09_bygg_med_koordinater.sql
-- Materialisert view mv_bygg_med_koordinater (attest + bygg + eiendom + koordinat per attest).
--
-- Hvorfor det er med: endepunktet POST api/bygg/refresh (CoordinateController.RefreshData) kjører
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_bygg_med_koordinater. Uten viewet gir kallet 500.
-- Definisjonen er hentet fra live-databasen med pg_get_viewdef; indeksene likeså.
-- Ingen annen SQL eller C#-kode leser viewet. Det er eldre enn 04-08 og bygger på de gamle
-- tabellene (energimerke, eiendom_bygning, eiendom, bygning, coordinates, kommune).
--
-- Den unike indeksen på attestnummer må være med: CONCURRENTLY krever en unik indeks.
-- Kan kjøres på nytt: DROP IF EXISTS (ingen andre views bygger på dette).

DROP MATERIALIZED VIEW IF EXISTS mv_bygg_med_koordinater;

CREATE MATERIALIZED VIEW mv_bygg_med_koordinater AS
SELECT DISTINCT ON (em.attestnummer)
    em.attestnummer,
    em.utstedelsesdato,
    em.energikarakter,
    em.oppvarmingskarakter,
    em.beregnet_energi_kwh_m2,
    em.beregnet_fossilandel,
    b.bygningsnummer,
    b."bygningID",
    b.bygningskategori,
    b.byggeaar,
    e."eiendomId",
    e.adresse,
    e.brukenhetsnummer,
    e.gaardsnummer,
    e.festenummer,
    e.postnummer,
    e.poststed,
    c.coordinateid,
    c.latitude,
    c.longitude
FROM energimerke em
     JOIN eiendom_bygning be ON em."bygningeiendomId" = be."bygningeiendomId"
     JOIN eiendom e ON be."eiendomId" = e."eiendomId"
     JOIN kommune k ON e.kommunenummer::text = k.kommunenummer::text
     LEFT JOIN bygning b ON be."bygningID" = b."bygningID"
     LEFT JOIN coordinates c ON e.coordinateid = c.coordinateid
ORDER BY em.attestnummer;

CREATE UNIQUE INDEX idx_bygg_attestnummer ON mv_bygg_med_koordinater (attestnummer);
CREATE INDEX idx_bygg_bygningid ON mv_bygg_med_koordinater ("bygningID");
CREATE INDEX idx_bygg_eiendomid ON mv_bygg_med_koordinater ("eiendomId");
CREATE INDEX idx_bygg_energikarakter ON mv_bygg_med_koordinater (energikarakter);
CREATE INDEX idx_bygg_koordinater ON mv_bygg_med_koordinater (latitude, longitude);
CREATE INDEX idx_bygg_postnummer ON mv_bygg_med_koordinater (postnummer);
