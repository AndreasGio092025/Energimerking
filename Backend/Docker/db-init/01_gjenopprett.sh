#!/bin/bash
# 01_gjenopprett.sh
# Gjenoppretter de 12 grunntabellene fra dumpfila før resten av db-init (02-09) bygger views og
# funksjoner på dem.
#
# Hvorfor dump og ikke SQL i repoet: grunndata (Enova-attester, matrikkel, koordinater) er ca.
# 50 MB og skal ikke i Git. Fila ligger lokalt i Backend/Docker/Data/ og monteres som /import
# (se docker-compose.yaml og README).
#
# Hvorfor feil hvis fila mangler: uten grunndata ville de neste skriptene feile med uforståelige
# meldinger om tabeller som ikke finnes, eller (verre) gi en tom database som ser ok ut.
# Dette skriptet stopper hele oppstarten tidlig, med beskjed om hva som må gjøres.
#
# Postgres kjører filene i /docker-entrypoint-initdb.d bare når datavolumet er tomt.
# Skal du bygge på nytt: stopp containeren, slett datavolumet og start igjen.

set -euo pipefail

DUMP=/import/grunndata.dump

if [ ! -f "$DUMP" ]; then
    echo "" >&2
    echo "FEIL: Fant ikke grunndata-dumpen ($DUMP i containeren)." >&2
    echo "Legg fila grunndata.dump i mappen Backend/Docker/Data/ og start på nytt med tomt datavolum." >&2
    echo "Se README.md (avsnittet om database) for hvor du får tak i fila." >&2
    echo "Fila ligger ikke i Git og skal ikke committes." >&2
    echo "" >&2
    exit 1
fi

echo "Gjenoppretter grunndata fra $DUMP ..."
# --exit-on-error: stopp ved første feil i stedet for å fortsette med en halvt bygd database.
# --no-owner/--no-privileges: dumpen er laget slik, og eier blir brukeren som kjører init.
pg_restore --no-owner --no-privileges --exit-on-error \
    -d "$POSTGRES_DB" -U "$POSTGRES_USER" "$DUMP"

# eiendom_id_seq (laget i 00_sekvens.sql) fikk ikke med seg verdien fra dumpen. Sett den til høyeste
# bygningID, så nye rader i bygning ikke kolliderer med eksisterende.
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -c \
    "SELECT setval('public.eiendom_id_seq', (SELECT COALESCE(max(\"bygningID\"), 1) FROM public.bygning));" > /dev/null

# Hvorfor ANALYZE: pg_restore tar ikke med planleggerstatistikk, og autovacuum rekker ikke å
# analysere før 07/08 bygger de store materialiserte viewene rett etterpå. Uten statistikk velger
# Postgres dårlige planer (målt: 08 brukte over 6 minutter; se loggen).
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -c "ANALYZE;"

echo "Grunndata gjenopprettet."
