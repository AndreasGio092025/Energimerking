# 2026-11-15 sql-agent: felles datagrunnlag for attester og enheter

Gren: `sql-attester-enheter` (fra `faglige-regler`, 00ee83e).

## Hva
Tre nye filer i `Backend/Docker/db-init/`: `04_attester.sql` (view `v_attester`, én rad per Oslo-attest fra 2025 og 2026), `05_siste_attest_per_enhet.sql` (materialisert view `mv_siste_attest_per_enhet`) og `06_kohort.sql` (funksjon `byggeaar_kohort(int)`). Ingen eksisterende objekter er endret; `mv_leilighet_siste_energimerke` er urørt.

## Hvorfor
- **Bygningsnummer og bygningskategori for 2025 hentes fra `enova_raw`** (`col19` = attestnummer, `col7` = bygningsnummer, `col13` = bygningskategori), ikke fra `energimerke`. Alle 126 363 denorm-attester finnes i `enova_raw`, mens `energimerke` mangler 654 av dem. Der begge finnes er bygningsnummeret likt (0 avvik). Bygningskategori finnes dermed for alle attester.
- **Ordning** regnes fra `utstedelsesdato` (før 2026-01-01 = gammel), likt for begge kilder.
- **Siste attest** med `DISTINCT ON (enhet_id, ordning)`, sortert på fullt tidsstempel og deretter attestnummer. Alternativ `row_number() = 1` gir samme resultat, men er lengre. Viewet har en ekstra kolonne `utstedt_tidspunkt` (utover det som ble bestilt) fordi mange attester har samme dato, og tidsstempelet gir riktig "siste".
- **Enhet uten bygningsnummer** gir `enhet_id = NULL` og telles ikke (se Usikkert).
- Tall: komma byttes til punktum og verdier vaktes med regex (ingen komma funnet i dataene, men vakten skader ikke). `Lightgreen` normaliseres til `LightGreen` via `lower()`-join mot `oppvarmingskarakter`.
- Byggeår: 0 og < 1800 blir NULL, og dermed NULL-kohort.

## Testet
Alle tre filer kjørt, og kjørt på nytt uten feil (`ON_ERROR_STOP=1`).

**Kjøretid:** bygge `mv_siste_attest_per_enhet`: 1,68 s (+ 2 indekser, ca. 80 ms hver). `REFRESH MATERIALIZED VIEW`: 1,49 s.

**Rader i `v_attester` (attester vs enheter):**

| ordning | attester | enheter (distinkte enhet_id) | uten enhet_id |
|---|---|---|---|
| gammel (2025-denorm) | 126 363 | 67 351 | 654 |
| ny (2026-energiattester) | 17 718 | 11 287 | 34 |

Ingen duplikate attestnummer. Totalt 144 081 rader. (126 363 er litt mer enn 125 973 oppgitt i oppgaven; det er antall rader i denorm.)

**`mv_siste_attest_per_enhet`:** 78 638 rader (67 351 gammel + 11 287 ny). 3 134 enheter har attest i begge ordninger (grunnlag for overgangsnøkkel senere).

**2025-attester som manglet nøkler:** 654 uten bygningsnummer (også i `enova_raw`, så de kan ikke kobles; `energimerke` gir samme 654). 1 569 uten bruksenhetsnummer, hvorav 1 068 har bygningsnummer og bruker bare bygningsnummer som enhet_id. For 2026: 34 uten bygningsnummer, 816 uten bruksenhetsnummer (788 med bygningsnummer).

**Fordeling per kohort (enheter, siste attest):**

| kohort | gammel | ny |
|---|---|---|
| før 1949 | 10 304 | 3 614 |
| 1949–1969 | 19 962 | 2 480 |
| 1970–1986 | 16 204 | 1 339 |
| 1987–1996 | 2 824 | 680 |
| 1997–2006 | 4 811 | 868 |
| 2007–2016 | 6 704 | 663 |
| 2017 og senere | 6 531 | 1 641 |
| uten kohort (byggeår mangler) | 11 | 2 |

Grensetest på `byggeaar_kohort`: 1800, 1948, 1949, 1969, 1970, 1986, 1987, 1996, 1997, 2006, 2007, 2016, 2017 gir riktig kohort; 0, 1799 og NULL gir NULL.

**Stikkprøver mot rådata (alle stemmer):**
1. Attest `0004396c-5ffb-4361-aa21-db6704be9132` (2025, `Lightgreen` i rådata): bygning 80299028, H0917, Nåkkves vei 1, 1967, karakter B, 89.88 kWh/m2, utstedt 2025-12-20 17:18:32; i viewet `LightGreen`, enhet_id `80299028-H0917`, ordning gammel, kategori Boligblokker (fra `enova_raw`).
2. Attest `001ab74c-8bc6-4c8b-aac7-3436a85b5c0e` (2026): bygning 80073011, H1001, Silurveien 46, 1962, F, 259.908..., 2026-01-30; i viewet enhet_id `80073011-H1001`, ordning ny, oppvarmingskarakter NULL.
3. Attest `00111d02-33cb-44e1-99e4-c26a474b901a` (2026, tomt bruksenhetsnummer): bygning 81315744, Økernveien 9, Hoteller, 1968, C; i viewet bruksenhetsnummer NULL og enhet_id `81315744`.

## Usikkert
1. **VIKTIGST: `bygningsnummer + bruksenhetsnummer` er ikke unik som enhet.** Samme bruksenhetsnummer (f.eks. H0101) gjenbrukes på ulike adresser/innganger i samme bygning. Eksempel: bygning 300154894 har H0101 på både Malerhaugveien 34E og 34F, utstedt samme sekund. Per (enhet_id, ordning) har 28 646 grupper mer enn én attest, og i 11 819 av dem med bruksenhetsnummer deler attestene samme tidsstempel (11 798 av dem har ulike adresser). Med adresse i nøkkelen ville antallet enheter vært ca. 108 107 (gammel) og 13 429 (ny), mot 67 351 og 11 287 nå. Jeg fulgte reglen slik den er skrevet, men dagens `mv_siste_attest_per_enhet` **slår derfor sammen ulike leiligheter og velger én tilfeldig (høyeste attestnummer)**. Eieren bør avgjøre om nøkkelen skal bli `bygningsnummer + bruksenhetsnummer + adresse`. Det er en liten endring i `04_attester.sql` (én linje i `enhet_id`).
2. **Enhet uten bruksenhetsnummer:** bare bygningsnummer brukes (som oppgitt). Alle slike attester i et bygg blir da én enhet, og de kan kollidere med en enhet som bare har bygningsnummer fordi den er den eneste.
3. **Enhet uten bygningsnummer:** `enhet_id = NULL`, utelatt fra det materialiserte viewet (654 + 34 attester). Alternativet var å bruke attestnummer som enhet; det ville gitt 688 ekstra "enheter" som kan være dubletter.
4. `energi_kwh_m2` i 2026 har mange desimaler (f.eks. 259.9083557128906). Jeg runder ikke; frontend/API bør runde.
5. 2025-viewet avhenger av `enova_raw`, en rå importtabell. Slettes eller reimporteres den, mister 2025-attestene bygningsnummer og kategori.
6. `v_attester` leser `energiattester` med filter `knr = '0301'`; ingen indeks på `knr`, men tabellen er liten nok (se kjøretid).
7. Kohorten er ikke koblet til noe view ennå; `byggeaar_kohort()` kalles der den trengs.
8. Ikke testet: REFRESH CONCURRENTLY (unik indeks finnes), og effekt på kjørende app (ingen eksisterende objekter ble endret).

## Lær dette
**Materialisert view vs vanlig view.** Et vanlig view (`v_attester`) er bare en lagret spørring: den kjøres på nytt hver gang noen leser fra den, og viser alltid ferske data, men kan være treg hvis den slår sammen mye. Et materialisert view (`mv_siste_attest_per_enhet`) lagrer resultatet som en ekte tabell, så lesing er rask og kan indekseres, men innholdet er et øyeblikksbilde. Når `energimerke`-, `denorm_`- eller `energiattester`-tabellene endres (ny import), må du kjøre `REFRESH MATERIALIZED VIEW mv_siste_attest_per_enhet;` ellers vises gamle tall. Her tar det ca. 1,5 s. Med `REFRESH MATERIALIZED VIEW CONCURRENTLY` (krever unik indeks, som vi har) kan appen fortsette å lese mens det bygges på nytt.
