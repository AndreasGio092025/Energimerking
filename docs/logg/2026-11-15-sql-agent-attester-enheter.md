# 2026-11-15 sql-agent: felles datagrunnlag for attester og enheter

Gren: `sql-attester-enheter` (fra `faglige-regler`, 00ee83e).

## Hva
Tre nye filer i `Backend/Docker/db-init/`: `04_attester.sql` (view `v_attester`, én rad per Oslo-attest fra 2025 og 2026), `05_siste_attest_per_enhet.sql` (materialisert view `mv_siste_attest_per_enhet`) og `06_kohort.sql` (funksjon `byggeaar_kohort(int)`). Ingen eksisterende objekter er endret; `mv_leilighet_siste_energimerke` er urørt.

## Hvorfor
- **Bygningsnummer og bygningskategori for 2025 hentes fra `enova_raw`** (`col19` = attestnummer, `col7` = bygningsnummer, `col13` = bygningskategori), ikke fra `energimerke`. Alle 126 363 denorm-attester finnes i `enova_raw`, mens `energimerke` mangler 654 av dem. Der begge finnes er bygningsnummeret likt (0 avvik). Bygningskategori finnes dermed for alle attester.
- **Ordning** regnes fra `utstedelsesdato` (før 2026-01-01 = gammel), likt for begge kilder.
- **Siste attest** med `DISTINCT ON (enhet_id, ordning)`, sortert på fullt tidsstempel og deretter attestnummer. Alternativ `row_number() = 1` gir samme resultat, men er lengre. Viewet har en ekstra kolonne `utstedt_tidspunkt` (utover det som ble bestilt) fordi mange attester har samme dato, og tidsstempelet gir riktig "siste".
- **Enhet = bygningsnummer + bruksenhetsnummer + adresse** (`enhet_id = '<bygningsnummer>|H0101|<adresse>'`). Endret av hovedsesjonen etter eierens avgjørelse 2026-11-15: bruksenhetsnummer gjentas på hver inngang i samme bygg, så uten adresse ble ulike leiligheter slått sammen (se Usikkert 1). Adressen normaliseres (små bokstaver, enkle mellomrom).
- **Enhet uten bygningsnummer** gir `enhet_id = NULL` og telles ikke (se Usikkert).
- Tall: komma byttes til punktum og verdier vaktes med regex (ingen komma funnet i dataene, men vakten skader ikke). `Lightgreen` normaliseres til `LightGreen` via `lower()`-join mot `oppvarmingskarakter`.
- Byggeår: 0 og < 1800 blir NULL, og dermed NULL-kohort.

## Testet
Alle tre filer kjørt, og kjørt på nytt uten feil (`ON_ERROR_STOP=1`).

**Kjøretid:** bygge `mv_siste_attest_per_enhet`: 1,68 s (+ 2 indekser, ca. 80 ms hver). `REFRESH MATERIALIZED VIEW`: 1,49 s.

**Rader i `v_attester` (attester vs enheter):**

| ordning | attester | enheter (distinkte enhet_id) | uten enhet_id |
|---|---|---|---|
| gammel (2025-denorm) | 126 363 | 108 107 | 654 |
| ny (2026-energiattester) | 17 718 | 13 429 | 34 |

(Med den første nøkkelen uten adresse var enhetene 67 351 og 11 287.)

Ingen duplikate attestnummer. Totalt 144 081 rader. (126 363 er litt mer enn 125 973 oppgitt i oppgaven; det er antall rader i denorm.)

**`mv_siste_attest_per_enhet`:** 121 536 rader (108 107 gammel + 13 429 ny), ingen duplikater per (enhet_id, ordning). 3 843 enheter har attest i begge ordninger (grunnlag for overgangsnøkkel senere). 15 346 enheter har mer enn én attest i samme ordning; der velges den siste.

**2025-attester som manglet nøkler:** 654 uten bygningsnummer (også i `enova_raw`, så de kan ikke kobles; `energimerke` gir samme 654). 1 569 uten bruksenhetsnummer, hvorav 1 068 har bygningsnummer og får enhet_id med tomt bruksenhetsnummer og adresse. For 2026: 34 uten bygningsnummer, 816 uten bruksenhetsnummer (788 med bygningsnummer).

**Fordeling per kohort (enheter, siste attest):**

| kohort | gammel | ny |
|---|---|---|
| før 1949 | 16 004 | 3 894 |
| 1949–1969 | 36 595 | 3 243 |
| 1970–1986 | 26 693 | 1 813 |
| 1987–1996 | 3 707 | 681 |
| 1997–2006 | 6 819 | 1 132 |
| 2007–2016 | 9 793 | 681 |
| 2017 og senere | 8 485 | 1 982 |
| uten kohort (byggeår mangler) | 11 | 3 |

Grensetest på `byggeaar_kohort`: 1800, 1948, 1949, 1969, 1970, 1986, 1987, 1996, 1997, 2006, 2007, 2016, 2017 gir riktig kohort; 0, 1799 og NULL gir NULL.

**Stikkprøver mot rådata (alle stemmer):**
Adresse, bruksenhetsnummer og attestnummer er utelatt for boliger, så stikkprøvene ikke peker på en husstand. Attestene kan finnes igjen ved å sortere `v_attester` på attestnummer (de tre første per kilde).
1. Boligblokk, 2025, `Lightgreen` i rådata: byggeår 1967, karakter B, 89.88 kWh/m2; i viewet `LightGreen`, enhet_id med bygningsnummer, bruksenhetsnummer og adresse, ordning gammel, kategori Boligblokker (fra `enova_raw`). Stemmer mot rådata.
2. Bolig, 2026: byggeår 1962, karakter F, 259.908... kWh/m2; i viewet ordning ny, oppvarmingskarakter NULL, enhet_id med bruksenhetsnummer. Stemmer mot rådata.
3. Hotell, 2026, tomt bruksenhetsnummer: byggeår 1968, karakter C; i viewet bruksenhetsnummer NULL og enhet_id `<bygningsnummer>||<adresse>`. Stemmer mot rådata.

## Usikkert
1. **VIKTIGST: `bygningsnummer + bruksenhetsnummer` er ikke unik som enhet.** Samme bruksenhetsnummer (f.eks. H0101) gjenbrukes på ulike adresser/innganger i samme bygning. Eksempel: én bygning har H0101 på både inngang E og F på samme gatenummer, utstedt samme sekund. Per (enhet_id, ordning) har 28 646 grupper mer enn én attest, og i 11 819 av dem med bruksenhetsnummer deler attestene samme tidsstempel (11 798 av dem har ulike adresser). **Løst:** eieren avgjorde å ta adressen med i nøkkelen. `enhet_id` er nå `bygningsnummer|bruksenhetsnummer|adresse`, og enhetene ble 108 107 (gammel) og 13 429 (ny) i stedet for 67 351 og 11 287. Gjenstår: samme leilighet med ulik skrivemåte av adressen mellom attester (utover store/små bokstaver og mellomrom) blir to enheter; ikke målt.
2. **Enhet uten bruksenhetsnummer:** bygningsnummer + adresse brukes. Attester uten bruksenhetsnummer på samme adresse i et bygg blir én enhet.
3. **Enhet uten bygningsnummer:** `enhet_id = NULL`, utelatt fra det materialiserte viewet (654 + 34 attester). Alternativet var å bruke attestnummer som enhet; det ville gitt 688 ekstra "enheter" som kan være dubletter.
4. `energi_kwh_m2` i 2026 har mange desimaler (f.eks. 259.9083557128906). Jeg runder ikke; frontend/API bør runde.
5. 2025-viewet avhenger av `enova_raw`, en rå importtabell. Slettes eller reimporteres den, mister 2025-attestene bygningsnummer og kategori.
6. `v_attester` leser `energiattester` med filter `knr = '0301'`; ingen indeks på `knr`, men tabellen er liten nok (se kjøretid).
7. Kohorten er ikke koblet til noe view ennå; `byggeaar_kohort()` kalles der den trengs.
8. Ikke testet: REFRESH CONCURRENTLY (unik indeks finnes), og effekt på kjørende app (ingen eksisterende objekter ble endret).

## Lær dette
**Materialisert view vs vanlig view.** Et vanlig view (`v_attester`) er bare en lagret spørring: den kjøres på nytt hver gang noen leser fra den, og viser alltid ferske data, men kan være treg hvis den slår sammen mye. Et materialisert view (`mv_siste_attest_per_enhet`) lagrer resultatet som en ekte tabell, så lesing er rask og kan indekseres, men innholdet er et øyeblikksbilde. Når `energimerke`-, `denorm_`- eller `energiattester`-tabellene endres (ny import), må du kjøre `REFRESH MATERIALIZED VIEW mv_siste_attest_per_enhet;` ellers vises gamle tall. Her tar det ca. 1,5 s. Med `REFRESH MATERIALIZED VIEW CONCURRENTLY` (krever unik indeks, som vi har) kan appen fortsette å lese mens det bygges på nytt.
