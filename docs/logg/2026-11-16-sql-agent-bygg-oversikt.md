# 2026-11-16 sql-agent: bygg-oversikt (SQL-funksjonene bak bygg-siden)

Gren: `sql-bygg-oversikt` (fra `f91944b`). Fil: `Backend/Docker/db-init/07_bygg_oversikt.sql`.
API-kontrakten er **ikke** endret; funksjonene følger `docs/api-kontrakt.md` (seksjonen "Bygg-oversikt") feltfor felt.

## Hva
Ny fil `07_bygg_oversikt.sql` med `bygg_fra_attest(text)` og `bygg_oversikt_json(text)` (pluss hjelpefunksjonene `bygg_lignende_grunnlag` og `bygg_lignende_json`) og tre små materialiserte views som gjør kallene raske (`mv_attester_per_bygg`, `mv_lignende_fordeling`, `mv_lignende_enheter`). Ingen eksisterende objekter er endret.

## Hvorfor
- **Ordningene blandes aldri.** Alt aggregeres per `ordning` (GROUP BY), og "lignende" slås opp i samme ordning. `ordninger` sorteres gammel før ny. `oppvarmingsfordeling` er `null` for ny ordning.
- **Lignende utelater byggets egne enheter** (`bygningsnummer <>`). Trinn 1 = kategori + kohort, trinn 2 (reserve) = bare kategori hvis trinn 1 har under 10 enheter eller bygget mangler kohort. `nok_data` = antall enheter i grunnlaget som ble brukt >= 10; ellers er alle sammenligningstall `null`.
- **Byggets kategori og byggeår** hentes fra byggets siste attest (høyeste utstedelsestidspunkt, attestnummer som tie-break). Attestene i et bygg er ofte uenige: kategori ulik i 383 av 18 183 bygg, byggeår i 2 302 (typisk 2 års forskjell, maks 185). Siste attest er nyest og gir ÉN verdi, så bygget får én kohort. Alternativet (flertallsverdi) ble forkastet som mer komplisert uten tydelig gevinst.
- **Ytelse:** første versjon (alt direkte mot `mv_siste_attest_per_enhet` og `v_attester`) brukte 1-3 s per kall: `v_attester` slår sammen to kilder og kobler mot `enova_raw` ved hvert kall (0,4-1 s), og "lignende" skannet og sorterte opptil 100 000 enheter per ordning. Løsning:
  - `mv_attester_per_bygg`: antall attester per bygg og ordning (21 112 rader).
  - `mv_lignende_fordeling`: antall enheter, bygg og per karakter per (ordning, kategori, kohort) og per (ordning, kategori) (175 rader). Byggets egne enheter trekkes fra, siden telling er additiv.
  - `mv_lignende_enheter`: alle enheter med kWh, sortert og nummerert (rang) per gruppe (243 058 rader, 54 MB inkl. indekser). Medianen for "gruppen uten bygget" finnes ved å hoppe over byggets egne rang-numre og slå opp midtelementene i indeksen, så vi slipper å sortere 100 000 verdier ved hvert kall. Resultatet er nøyaktig det `percentile_cont(0.5)` ville gitt på gruppen uten bygget (verifisert under).
  - Alternativet "bare grupperte medianer per gruppe" ble forkastet: en median kan ikke trekkes fra, og å ta med byggets egne enheter bryter regelen.
- **Andeler** avrundes til tre desimaler. Lignende-karakterfordelingen justeres så den summerer til nøyaktig 1 (avviket, maks 0,003, legges på største andel).
- **Avrundede medianer brukes i sammenligningene** (`andel_med_hoyere_energibruk`, `andel_enheter_bedre_enn_lignende`), slik at tallene stemmer med det grensesnittet viser.
- Etter ny import må viewene oppdateres i denne rekkefølgen (står også øverst i filen): `mv_siste_attest_per_enhet`, `mv_attester_per_bygg`, `mv_lignende_fordeling`, `mv_lignende_enheter`. Tid: 0,4 + 0,5 + 3,4 s.

## Testet
Mot lokal Postgres (`energimerke-db`, `Kodehode`/`Energimerking`).

- **Kjørt to ganger uten feil** med `ON_ERROR_STOP=1` (5,7 s per kjøring, mest bygging av viewene).
- **Radantall:** `mv_attester_per_bygg` 21 112, `mv_lignende_fordeling` 175, `mv_lignende_enheter` 243 058. `bygg_oversikt_json` gir 21 112 (bygg, ordning)-rader totalt (15 508 gammel, 5 604 ny), alle 18 183 bygg dekket.
- **Kjøretid** (snitt av 50 kall i en løkke, varm cache; første kall via psql 5-30 ms):

  | Bygg | Beskrivelse | Snitt per kall |
  |------|-------------|----------------|
  | 80582544 | største bygg, 342 enheter (334 gammel + 8 ny) | 3,1 ms |
  | 80489110 | småhus, 34 enheter | 0,9 ms |
  | 80153902 | sykehjem, 27 enheter (trinn 2) | 0,5 ms |

  Alle langt under målet på 200 ms. Alle 21 112 (bygg, ordning)-par ble beregnet på 9 s totalt (0,4 ms i snitt). `bygg_fra_attest`: ca. 70 ms (søker i `v_attester`, som er det eneste som ikke er forhåndsberegnet; innenfor målet, men kan få eget oppslagsview om det blir tregt i bruk).
- **Automatisk kontroll mot brute force:** 576 (bygg, ordning)-par (400 tilfeldige bygg, de 25 største, 60 ikke-boliger) ble sammenlignet med en naiv spørring som regner `percentile_cont` direkte på gruppen uten bygget: grunnlag, antall enheter, antall bygg, `nok_data`, begge medianer, `andel_med_hoyere_energibruk` og `andel_enheter_bedre_enn_lignende`. **0 avvik.**
- **Regelkontroller over alle 21 112 rader:** lignende-karakterfordelingen summerer til 1 i alle (0 avvik); alle sju karakternøkler finnes alltid; `oppvarmingsfordeling` er `null` i alle ny-rader og aldri i gammel (0 avvik); `andel_enheter_bedre_enn_lignende` er `null` når bygget har under 3 enheter, og aldri `null` ellers når `nok_data` er sann (0 avvik); `antall_attester >= antall_enheter` overalt. Ukjent bygningsnummer/attestnummer gir `NULL`.

### Tre stikkprøver mot rådata
Regnet med en egen spørring rett fra `v_attester` (egen "siste attest per enhet" med `row_number()`, egne kohortgrenser skrevet inn på nytt), ikke fra viewene funksjonene bruker. Alle for gammel ordning.

| Bygg | Størrelser | Rådata (egen spørring) | Funksjonen |
|------|-----------|------------------------|------------|
| Boligblokk (80582544, bygget 1940) | enheter | 334 | 334 |
| | byggets median | 253,3 | 253,3 |
| | lignende, trinn 1 (Boligblokker, før 1949): enheter / median / andel høyere | 14 687 / 249,3 / 0,483 | 14 687 / 249,3 / 0,483 |
| Småhus (80489110) | enheter / median | 34 / 167,6 | 34 / 167,6 |
| | lignende, trinn 1: enheter / median / andel høyere | 34 022 / 189,4 / 0,663 | 34 022 / 189,4 / 0,663 |
| Sykehjem (80153902, 1940) | enheter / median | 27 / 245,1 | 27 / 245,1 |
| | trinn 1 gir 0 enheter, så trinn 2 (Sykehjem uansett år): enheter / median / andel høyere | 10 / 225,6 / 0,200 | 10 / 225,6 / 0,200, grunnlag "bare kategori", `nok_data` sann |
| Sykehus (80955731) | enheter / median | 1 / 532,7 | 1 / 532,7 |
| | trinn 2: enheter | 5 | 5, `nok_data` usann, alle sammenligningstall `null` ("for få") |

Sykehjemmet er et grensetilfelle: nøyaktig 10 lignende enheter gir `nok_data` = sann (grensen er >= 10).

### Antall bygg per grunnlag og ordning
"For få" = reservetrinnet ga under 10 enheter (`nok_data` usann). Ingen bygg mangler kategori.

| Ordning | Trinn 1 (kategori og byggeår) | Trinn 2 (bare kategori) | For få | Sum bygg |
|---------|------------------------------:|------------------------:|-------:|---------:|
| gammel | 15 315 | 178 | 15 | 15 508 |
| ny | 5 492 | 89 | 23 | 5 604 |

### Eksempel på full utdata (bygg 80582544, adresser erstattet)
Feltrekkefølgen er slik den kommer ut av databasen (formatert for lesing):

```json
{
  "bygningsnummer": "80582544",
  "adresser": ["<adresse>", "<adresse>", "..."],
  "bygningskategori": "Boligblokker",
  "byggeaar": 1940,
  "kohort": "før 1949",
  "minimum_lignende": 10,
  "ordninger": [
    {
      "ordning": "gammel",
      "periode": "attester utstedt i 2025",
      "antall_enheter": 334,
      "antall_attester": 439,
      "karakterfordeling": {"A": 0, "B": 0, "C": 0, "D": 0, "E": 0, "F": 194, "G": 140},
      "median_kwh_m2": 253.3,
      "oppvarmingsfordeling": {"Green": 327, "LightGreen": 7, "Yellow": 0, "Orange": 0, "Red": 0},
      "lignende": {
        "grunnlag": "kategori og byggeår",
        "antall_enheter": 14687,
        "antall_bygg": 2528,
        "nok_data": true,
        "karakterfordeling": {"A": 0.000, "B": 0.027, "C": 0.038, "D": 0.115, "E": 0.158, "F": 0.256, "G": 0.406},
        "median_kwh_m2": 249.3,
        "andel_med_hoyere_energibruk": 0.483,
        "andel_enheter_bedre_enn_lignende": 0.431
      }
    },
    {
      "ordning": "ny",
      "periode": "attester utstedt i 2026",
      "antall_enheter": 8,
      "antall_attester": 9,
      "karakterfordeling": {"A": 0, "B": 0, "C": 3, "D": 0, "E": 4, "F": 1, "G": 0},
      "median_kwh_m2": 399.6,
      "oppvarmingsfordeling": null,
      "lignende": {
        "grunnlag": "kategori og byggeår",
        "antall_enheter": 3365,
        "antall_bygg": 1586,
        "nok_data": true,
        "karakterfordeling": {"A": 0.000, "B": 0.005, "C": 0.120, "D": 0.151, "E": 0.218, "F": 0.183, "G": 0.323},
        "median_kwh_m2": 292.2,
        "andel_med_hoyere_energibruk": 0.223,
        "andel_enheter_bedre_enn_lignende": 0.375
      }
    }
  ]
}
```

## Usikkert
- **Kategori og kohort er felles for begge ordninger i samme bygg**, hentet fra byggets siste attest uansett ordning (er det en ny-attest, er det den som avgjør). Kontrakten har bare ett `bygningskategori`/`byggeaar`/`kohort` på toppnivå, så jeg valgte det enkleste. Når attestene i bygget er uenige (se tallene over), kan et bygg få en annen kohort enn de fleste enhetene sine; eieren bør vurdere om flertallsverdi er bedre.
- **Lignende-gruppen bruker hver enhets egne kategori/byggeår-felt** (fra enhetens siste attest), ikke byggets "samlede" verdi. Samme bygg kan derfor ha enheter i to ulike kohorter i gruppene til andre bygg.
- **`periode`** bygger på utstedelsesdatoene til enhetenes *siste* attester (grunnlaget for statistikken), ikke alle attester i bygget. I dagens data gir det alltid "attester utstedt i 2025" (gammel) og "attester utstedt i 2026" (ny); "2024–2025"-formen er implementert, men aldri utløst, og ikke testet mot data.
- **Materialiserte views må oppdateres** etter hver import (rekkefølge øverst i filen). Glemmes det, gir funksjonene tall fra forrige import. Kobles best til importskriptet; det er utenfor min mappe.
- **Datakvalitet:** 20 bygg (22 enheter) har ugyldige bygningsnumre som "7" eller "40" (kort, ikke 7-9 siffer). De får samme behandling som andre bygg, men kan slå sammen urelaterte enheter. Bør vurderes filtrert i `v_attester`.
- **Ukjent kategori** gir `grunnlag` = null og 0 enheter slik kontrakten sier, men ingen bygg i dagens data har det, så grenen er ikke testet mot ekte data.
- `bygg_fra_attest` bruker `v_attester` direkte (ca. 70 ms). Fint for en enkelt oppslag, men kan trenge eget indeksert oppslag hvis den kalles ofte.
- Større enn nødvendig? `mv_lignende_enheter` tar 54 MB. Det er billig lokalt, men vurder om det er greit i produksjon.

## Lær dette
**`percentile_cont` og hvorfor median er bedre enn gjennomsnitt her.**
`percentile_cont(0.5) WITHIN GROUP (ORDER BY x)` er SQLs "kontinuerlige persentil": den sorterer verdiene og tar den midterste (ved partall interpoleres lineært mellom de to midterste). 0,5 betyr 50 %, altså medianen.
I energidata finnes det noen få bygg med svært høyt forbruk (f.eks. 500+ kWh/m²) og noen med svært lavt. Et gjennomsnitt trekkes mot slike ytterpunkter, og et "lignende bygg"-tall ville flyttet seg på grunn av noen få bygg. Medianen er verdien der halvparten bruker mer og halvparten mindre, og bryr seg ikke om hvor ekstrem de ytterste er. Den svarer dermed på det brukeren faktisk lurer på ("bruker jeg mer enn en typisk lignende bolig?"). Derfor kombinerer siden også medianen med karakterfordelingen, så spredningen i bygget ikke skjules.
I denne leveransen er det en bivirkning å passe på: en median kan ikke regnes ut fra delsummer (man kan ikke trekke byggets enheter fra en ferdig median). Derfor lagrer `mv_lignende_enheter` alle verdiene sortert med rang, slik at medianen "uten bygget" kan slås opp direkte.
