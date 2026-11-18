# 2026-11-17 sql-agent: enheter i kartet (`api/enheter`)

## Hva
Ny fil `Backend/Docker/db-init/08_enheter_kart.sql` med materialisert view `mv_enhet_punkt` (kartpunkt per enhet og ordning, GiST-indeks), funksjonene `enheter_punkter_json(lat, lon, radius_m, ordning)` og `enheter_statistikk_json(lat, lon, radius_m)` etter kontrakten, og `refresh_enheter_kart()`. 07 har fått en kommentar som peker på den nye refresh-funksjonen (ingen kodeendring). Kontrakten er ikke endret.

## Hvorfor
- **Koordinat-kjede.** Per (enhet, ordning) brukes første treff av: `a_attest` (attestens egen rad i denorm-tabellen), `b_annen_ordning`, `c_bygg_adresse` (annen enhet i samme bygg og med samme adresse), `d_matrikkel_adr` (`coordinates`: samme gnr/bnr og adresse), `c_bygg` (samme bygg, annen adresse), `d_matrikkel_gb` (`coordinates`: samme gnr/bnr, annen adresse; punktet nærmest tyngdepunktet), ellers `ingen`. Metoden lagres i kolonnen `punkt_metode`, ikke i API-et.
- **Avvik fra oppgavens rekkefølge:** matrikkelens adressepunkt (`d_matrikkel_adr`) går foran `c_bygg`. Målt: `c_bygg`-punktet ligger i median 19 m (90 %: 42 m, maks 134 m) fra adressepunktet, mens `c_bygg_adresse` faller sammen med det (0 m).
- **`eiendom` brukes ikke.** `eiendom.coordinateid` peker ofte på en annen eiendoms punkt (rader med samme gnr/bnr peker på punkter med andre gnr/bnr). For de 99 enhetene bare `eiendom` kunne plassere lå punktet i median 313 m (maks 1,6 km) fra nærmeste enhet i samme gate. De er heller `ingen`. Riktige treff ligger uansett i `coordinates`.
- **22 `coordinates`-rader** har lat/lon, men mangler `geography`; punktet bygges da av lat/lon. 951 rader har ingen lengdegrad og kan ikke brukes.
- **Geometri:** `geometry(Point, 25832)` (UTM sone 32, meter) i stedet for 4258/4326. `ST_DWithin` blir da en rask planar meteravstand (skalafeil ca. 0,03 %, under 1 m på 2300 m) og GiST-indeksen kutter tettere enn for `geography`. Kildene (ETRS89) og brukerens WGS84 regnes som samme datum (under 1 m forskjell i Norge). lat/lon (6 desimaler) lagres også, til GeoJSON og til å definere "identisk koordinat".
- **Ferdigbygd GeoJSON-feature** lagres i viewet (`feature`). Å bygge 21 000 objekter per kall tok ca. 0,7 s; nå limes de sammen. Radene er sortert på geohash, så en kartsirkel leser få disksider.
- **`id`** = `left(md5(salt || enhet_id || ordning), 16)`. Salt (tilfeldig, laget én gang per database i tabellen `enhet_kart_salt`, ikke i repoet), fordi `enhet_id` er gjettbar (bygningsnummer og adresse er offentlige, bruksenhetsnummer er H0101 osv.) og en usaltet hash kunne vært brutt. Samme enhet har ulik id under `ordning=alle`.
- **Punkter:** begrenset til 50 000, de nærmeste midten først; `avkortet` = sann hvis punkt nr. 50 001 fantes. Den romlige avgrensningen gjøres i en egen `MATERIALIZED` CTE før ordningsfilteret: slått sammen kombinerte Postgres GiST med en indeks på `ordning` og leste 108 000 rader.
- **Statistikk:** `antall_attester` forhåndsberegnet per enhet i viewet (fra `v_attester`) og summert; `enheter_uten_kartpunkt` og periode fra den lille `mv_enhet_punkt_oversikt`. `periode` bygges av min/maks utstedelsesår i dataene ("attester utstedt i 2025" / "i 2026"). `oppvarmingsfordeling` har alle fem kodene og er `null` for ny ordning. Kohortnavn hentes fra `byggeaar_kohort()` med eksempelår, så grensene står fortsatt bare i 06. `jit = off` på funksjonene (JIT kostet 30-60 ms per kall).
- **Refresh:** ny `refresh_enheter_kart()` som kaller `refresh_bygg_oversikt()` og så de to nye viewene. Alternativet (utvide `refresh_bygg_oversikt()` i 07) ville duplisert hele funksjonen her og blitt rullet tilbake hvis 07 kjøres på nytt.

## Testet
Alt mot lokal Postgres (`energimerke-db`, PostGIS 3.5).
- `08_enheter_kart.sql` kjørt to ganger uten feil (første gang ca. 25 s, fordi viewet leser `v_attester`). `SELECT refresh_enheter_kart();` kjørt: 121 536 rader i `mv_enhet_punkt` (= `mv_siste_attest_per_enhet`), 21,6 s totalt.
- **Dekning per metode (enheter):**

| Metode | gammel | ny |
|---|---|---|
| a_attest | 106 852 | 0 |
| b_annen_ordning | 0 | 3 833 |
| c_bygg_adresse | 0 | 3 115 |
| d_matrikkel_adr | 222 | 6 314 |
| c_bygg | 602 | 31 |
| d_matrikkel_gb | 379 | 105 |
| ingen | 52 | 31 |
| **Sum / med punkt** | 108 107 / 108 055 (99,95 %) | 13 429 / 13 398 (99,77 %) |

  Til sammenligning: for ny ordning manglet 5 264 av 13 429 enheter punkt etter trinn a-c; matrikkelen (`coordinates`) tok det ned til 31. Med `eiendom` hadde `ingen` vært 30 / 28, men de 99 ekstra punktene var upålitelige (se over).
- **Kjøretid** (psql, warm, json ferdig i databasen; første kall etter oppstart kan ta 300-600 ms):
  - Gamle Oslo (59.9056, 10.7867, r 2300): punkter `gammel` 135-145 ms (21 161 punkter, `avkortet` = false), statistikk 66-75 ms.
  - Alle ordninger, r 3000 rundt 59.91733, 10.844128: punkter `alle` 170-270 ms (25 651 punkter), statistikk 73-97 ms.
  - r 20 000, `alle`: tak nådd, 50 000 punkter, `avkortet` = true (ca. 1-2 s; ikke et reelt bruksmønster).
- **Kontroller (hele Oslo, radius 20 000):**
  - `antall_enheter` + `enheter_uten_kartpunkt` = 108 055 + 52 = 108 107 (gammel) og 13 398 + 31 = 13 429 (ny) = antall i `mv_siste_attest_per_enhet`.
  - `karakterfordeling`, `kohortfordeling` (og `oppvarmingsfordeling` for gammel) summerer til `antall_enheter`; `oppvarmingsfordeling` er null for ny.
  - Nøklene i punkt-egenskapene er nøyaktig de tolv i kontrakten; ingen bruksenhetsnummer, attestnummer eller `enhet_id`. Ugyldig radius/ordning/posisjon gir SQL-feil (SQLSTATE 22023) som API-et kan gjøre til 400.
- **Stikkprøver mot rådata:**
  1. `a_attest`: alle 106 852 punkter er identiske (under 0,5 m) med `denorm...coordinate` for attesten.
  2. `b_annen_ordning`: alle 3 833 nye enheter har samme punkt som gammel attest av samme enhet; `d_matrikkel_adr`: alle 6 314 har samme punkt som `coordinates`-raden med samme gnr/bnr/adresse; `c_bygg_adresse`: alle 3 115 sammenfaller med et `a_attest`-punkt i samme bygg og adresse.
  3. *(Rettet av hovedsesjonen: tallene under er fra en tidligere kjøring. Riktig i den ferdige versjonen, også målt gjennom API-et og i ny database bygget fra repoet: 21 151 enheter, 25 016 attester, 1 900 bygg.)* Gamle Oslo, gammel ordning: 21 161 enheter, 25 028 attester, 1 902 bygg, median 161,5 og snitt 184,4 kWh/m², 2 892 på G regnet direkte på `mv_enhet_punkt` med `ST_Distance`; antall attester stemmer også mot telling i `v_attester` for samme enheter (25 028). Samme sirkel regnet i geography (sfære) gir 21 142 enheter: de 19 ekstra er enheter innenfor ca. 1 m av kanten (UTM-skalafeilen).
- **Nøyaktighet for omplasserte enheter** (avstand til nærmeste enhet med eget punkt på samme gnr/bnr): `d_matrikkel_adr` median 20 m, 90 % 62 m, maks 195 m (andre adresser på samme eiendom ligger så langt unna hverandre); `d_matrikkel_gb` median 51 m, 90 % 105 m, maks 212 m i samme gate; `c_bygg` 0 m fra et punkt i samme bygg.
- Største antall enheter på samme punkt: 228. Alle punkter ligger i Oslo (lat 59,82-60,04, lon 10,60-10,95).

## Usikkert
- **Størrelse på svaret.** Gamle Oslo gir 21 000 punkter, ca. 9,6 MB JSON (ca. 450 byte per punkt). Selve SQL-en er rask, men nettverk og kartet bør vurderes (tak 50 000 gir over 20 MB). Eieren kan beslutte et lavere tak eller færre egenskaper per punkt; det krever endret kontrakt.
- **`ordning=alle` og `antall_enheter_samme_punkt`** teller bare i samme ordning (som kontrakten sier), så en blokk kan vise f.eks. 40 punkter i hver ordning på samme koordinat.
- **Punkter fra `d_matrikkel_gb` og `c_bygg` er tilnærminger** (inntil ca. 100-200 m på store eiendommer). Det gjelder 1 117 enheter (0,9 %). Hvis kartet bør skille dem, kan `punkt_metode` eksponeres senere.
- **`id` er stabil bare i samme database** (saltet). Gjenskapes databasen fra scratch, får enhetene nye id-er.
- **52 + 31 enheter (0,07 %) har ingen koordinat** (ingen `coordinates`-rad med lengdegrad, og `eiendom` er ikke trygg).
- **Refresh:** den som importerer må kjøre `refresh_enheter_kart()` (ikke bare `refresh_bygg_oversikt()`), ellers står kartpunktene på forrige import. Viewet har ingen vakt mot dette.
- Ikke testet gjennom C#/HTTP; bare SQL-funksjonene. *(Senere gjort av hovedsesjonen: API og kart er testet mot ekte data, og panelet stemmer med API-et.)*

## Lær dette
**Romlig indeks (GiST) og `ST_DWithin`.** Å finne "alle punkter innenfor 2300 m" ved å regne avstand til hver av 121 000 rader er tregt. En GiST-indeks (Generalized Search Tree) lagrer punktene som omsluttende bokser i et tre. `ST_DWithin(punkt, midt, 2300)` ber først indeksen om alle bokser som overlapper en boks 2300 m rundt midtpunktet (raskt, hopper over resten av byen), og regner så nøyaktig avstand bare for kandidatene. Funksjonen bruker bare indeksen når begge geometrier har samme koordinatsystem og avstanden er i systemets enhet; derfor lagres punktene i UTM (meter) og ikke i grader. Her ga indeksen også en overraskelse: uten å skille ut den romlige delen i en egen CTE valgte planleggeren å kombinere indeksen med en vanlig indeks på `ordning` og leste 108 000 rader. Se `EXPLAIN ANALYZE` hvis en romlig spørring plutselig blir treg.
