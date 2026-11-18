-- 00_extensions.sql
-- Utvidelsene databasen trenger, laget FØR grunndata gjenopprettes (01_gjenopprett.sh).
--
-- Hvorfor vi lager dem selv: postgis-imaget har et eget initskript (10_postgis.sh) som lager
-- postgis, postgis_topology, fuzzystrmatch og postgis_tiger_geocoder. Det ligger i samme mappe
-- som vår (/docker-entrypoint-initdb.d), og bind-mounten i docker-compose erstatter hele mappen.
-- Imagets skript kjører altså ikke, og ingen utvidelser finnes før vi lager dem her.
--
-- Hva som er med, og hvorfor:
--   postgis   typene geography/geometry i coordinates og denorm_matrikkel_og_enova_oslo, og
--             ST_*-funksjonene i 03 (vektor-tiles) og 08 (enheter i kartet).
--   pg_trgm   indeksen idx_coordinates_adresse_trgm i grunndata-dumpen bruker gin_trgm_ops.
--             Uten utvidelsen feiler gjenopprettingen når indeksen skal bygges.
--
-- Hva som bevisst IKKE er med (finnes i live-databasen, men ingenting bruker det):
--   postgis_topology, postgis_tiger_geocoder  kommer bare fra image-oppsettet; ingen tabell,
--             view, funksjon eller C#-kode bruker topology- eller tiger-skjemaene.
--   fuzzystrmatch   ingen bruk av levenshtein/soundex o.l. i SQL eller C#. (EF-modellen lister
--             den med HasPostgresExtension, men det er bare et spor fra scaffolding.)
--
-- Kan kjøres på nytt (IF NOT EXISTS).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
