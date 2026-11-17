-- 00_sekvens.sql
-- Sekvensen eiendom_id_seq, laget FØR grunndata gjenopprettes (01_gjenopprett.sh).
--
-- Hvorfor: tabellen bygning har "bygningID" bigint DEFAULT nextval('public.eiendom_id_seq'). Sekvensen
-- er ikke eid av noen kolonne, så den kom ikke med i grunndata.dump (dumpen tok bare tabellene og
-- sekvensene de eier). Uten sekvensen feiler CREATE TABLE bygning under pg_restore med
-- «relation public.eiendom_id_seq does not exist».
-- Verdien settes etter gjenopprettingen (01_gjenopprett.sh), så neste nye bygg ikke får en id
-- som allerede finnes.
--
-- Kan kjøres på nytt (IF NOT EXISTS).

CREATE SEQUENCE IF NOT EXISTS public.eiendom_id_seq;
