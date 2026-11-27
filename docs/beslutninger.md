# Beslutninger

Kort logg over valg som er viktige eller dyre å endre. Nyeste øverst.

## 2026-11-19: «Enkel bygg» per bygg og aldersprioritet etter kohort (eieren)
**Beslutning:**
- Laget «Per bygg» i «Enkel bygg» henter bygningskategori og byggeår fra byggets siste attest **innen valgt ordning**, ikke på tvers av ordningene.
- Oppgraderingsprioritet bruker `kohort` fra API-et: før 1987 (før 1949, 1949–1969, 1970–1986) gir høy aldersprioritet, 1987–1996 og 1997–2006 middels, 2007 og senere lav. Mangler kohort, regnes byggeår som ukjent.
- Ubrukte attest-endepunkter (`GetTilePointDetails`, `GetBoundsDeNormGeoJson`) og `custom_ST_GetPoints` i live-DB fjernes som egen jobb.

**Hvorfor:** Med siste attest på tvers fikk 509 bygg (2,4 %) en annen byggeårsgruppe i «Per bygg» enn enhetene deres i «Per enhet», og gammel ordning kunne vise byggeår fra en attest i ny ordning. Innen ordningen holder kartet ordningene helt adskilt; bygg-siden (`bygg_oversikt_json`) bruker fortsatt siste attest på tvers. Aldersprioritet etter kohort fjerner de egne årsgrensene i nettleseren (`< 1987`, `< 2010`); høy er uendret, mens bygg fra 2007–2009 flytter fra middels til lav fordi grensen nå følger forskriftsperioden 2007–2016.

## 2026-11-17: Kjente tellehull får stå (eieren)
**Beslutning:** Tallene i appen er litt for lave, og det lar vi stå inntil videre. Det gjelder 2025 og 2026.
- **2025 (gammel ordning):** CSV-fila fra Enova (`01012025_31122025.csv`, Knr 0301) har 126 844 attester og 108 316 enheter. Databasen har 126 363 attester og 108 107 enheter. Forskjellen er 481 attester som finnes i `enova_raw`, men ikke i `denorm_matrikkel_og_enova_oslo` (laget for hånd i pgAdmin). Mange er nye bygg med bygningsnummer 3001…, og netto mangler 209 enheter.
- **2026 (ny ordning):** CSV-fila (`01012026_15072026_v2.csv`) har 62 Oslo-attester med Knr «301» i stedet for «0301». `04_attester.sql` filtrerer på `knr = '0301'`, så de kommer ikke med. Det gir 8 enheter (53 av attestene mangler bygningsnummer). For Knr 0301 er tallene like: 17 718 attester og 13 429 enheter.
- **Uten bygningsnummer:** 871 attester (2025) og 87 (2026) telles som attester, men ikke som enheter. Det er etter regelen.

**Hvorfor:** Forskjellen er under 0,2 %. Rettingen er å hente de manglende 2025-attestene fra `enova_raw` og godta `knr IN ('0301','301')` i `04_attester.sql`. Det krever ny test av tall og kartpunkter. Målt av hovedsesjonen 2026-11-17 ved å telle CSV-filene og sammenligne med `v_attester` og `mv_siste_attest_per_enhet`.

## 2026-11-17: API-svar komprimeres, også over HTTPS
**Beslutning:** Backend komprimerer svar med Brotli/gzip (`AddResponseCompression`, `EnableForHttps = true`). Punktsvaret for en bydel går fra 9,6 MB til 0,8 MB på nettet; JSON-formatet er uendret. Dette løser svarstørrelsen fra beslutningen om enheter i kartet uten ny kontrakt.
**Hvorfor:** Komprimering over HTTPS er bare risikabelt (BREACH) når svar har hemmeligheter, og appen har i dag verken innlogging, cookies eller tokens i svar. **Vurder på nytt hvis det kommer.** Lavere tak eller færre felter (ny kontrakt) vurderes hvis nettleseren blir treg av å lese 9,6 MB JSON. Se `docs/logg/2026-11-17-hovedsesjon-api-komprimering.md`.

## 2026-11-17: Databasen bygges fra repoet og en lokal dump (eieren)
**Beslutning:** Skjema, views og funksjoner ligger i `Backend/Docker/db-init/` og kjøres automatisk på tomt volum. Grunndataene (12 tabeller, ca. 53 MB) ligger i `grunndata.dump`, som ikke er i Git; eieren lagrer den på Google Drive og lager ny etter hver import. Bare utvidelsene `postgis` og `pg_trgm` tas med, og `mv_bygg_med_koordinater` legges i repoet fordi `POST api/bygg/refresh` bruker den. Gamle views som ikke brukes (`mv_energimerke`, `mve_energimerke`, `v_bygg_med_koordinater`, `v_energimerke_oslo`, `mv_leilighet_siste_energimerke`) tas ikke med. Database og pgAdmin lytter bare på `127.0.0.1`, passord står i en lokal `.env`, og Postgres er låst til 17 / PostGIS 3.5.
**Hvorfor:** Denorm-tabellen og 2026-importen ble laget for hånd i pgAdmin, så ingen kunne bygge databasen på nytt om volumet forsvant. Dumpen i Git ville gjort repoet tregere for alltid (Git glemmer ikke gamle versjoner); en lokal fil gir samme sikkerhetskopi uten den kostnaden. Testet: ny database ga identiske tall med live (108 107 / 13 429 enheter, Gamle Oslo 21 151). Se `docs/logg/2026-11-17-sql-agent-database-fra-repo.md`.

## 2026-11-17: Enheter i kartet: popup, fotnote og svarstørrelse (eieren)
**Beslutning:** Kartet viser alle tall per enhet også for småhus med én enhet (adresse, karakter, beregnet levert energi, dato), som på bygg-siden. Enheter uten kartpunkt (0,07 % i hele Oslo) står som fotnote nederst i områdestatistikken, ikke øverst. Punktsvaret får være ca. 9,6 MB per bydel (gammel ordning, Gamle Oslo) inntil videre.
**Hvorfor:** Dataene er offentlige hos Enova, og kartet bør være konsekvent med bygg-siden. Tallet uten posisjon gjelder hele Oslo og er lite, så det skal ikke ta plass fra tallene for området. Svarstørrelsen kan tas senere med komprimering eller lavere tak (det siste krever endret kontrakt).

## 2026-11-17: Kartpunkt per enhet (koordinat-kjede)
**Beslutning:** Hver enhet får kartpunkt fra første treff av: egen attest, samme enhet i andre ordning, samme bygg og adresse, matrikkelens adressepunkt (`coordinates`), annen enhet i samme bygg, annet punkt på samme gnr/bnr. Ingen treff = ingen punkt (telles i `enheter_uten_kartpunkt`). Tabellen `eiendom` brukes ikke som koordinatkilde. Dekning: 99,95 % (gammel) og 99,77 % (ny).
**Hvorfor:** Målt: `eiendom.coordinateid` peker ofte på en annen eiendoms punkt (median 313 m fra nærmeste enhet i samme gate), mens `coordinates` på gnr/bnr treffer riktig. Matrikkelens adressepunkt er bedre enn et nabopunkt i bygget (median 19 m forskjell). Se `docs/logg/2026-11-17-sql-agent-enheter-kart.md`.

## 2026-11-16: Fagord og telling i kartet
**Beslutning:** Energitallet heter «beregnet levert energi» (kWh/m² per år) overalt. Tall skal si hva de teller: statistikkpanelet og kartpunktene teller enheter (siste attest per enhet), «Enkel bygg» viser attester. Rå feilmeldinger fra server eller database vises aldri for brukeren.
**Hvorfor:** Feltet fra Enova er beregnet levert energi; «energibehov» er et annet fagbegrep. Første reviewer-runde trodde panelet talte attester fordi tabellen har én rad per attest, men backend grupperer per enhet og frontend velger siste attest (andre runde, målt: 20 000 attester gir 16 900 enheter i Gamle Oslo). Enhetsnøkkelen i frontend følger ikke regelen helt; det er neste oppgave (se «Kjente åpne punkter» i CLAUDE.md).

## 2026-11-16: Bygg med én eller to enheter vises med fulle tall
**Beslutning:** Bygg-oversikten viser karakter, beregnet levert energi og sammenligning også for bygg med én eller to enheter, selv om tallene da i praksis er én boligs.
**Hvorfor:** Energiattestene er offentlige hos Enova og vises allerede per attest i kartet. Å skjule dem ville gitt de fleste småhus en nesten tom bygg-side. API-et gir fortsatt aldri bruksenhetsnummer, attestnummer eller `enhet_id`.

## 2026-11-16: Reserve-trinn for lignende bygg, og spredning i bygget
**Beslutning:**
- Har kategori + kohort under 10 enheter, sammenlignes med hele kategorien uansett byggeår. API-et sier hvilket grunnlag som er brukt (`grunnlag`).
- Bygg-oversikten viser hvor stor andel av byggets enheter som er bedre enn medianen for lignende bygg, men bare for bygg med minst 3 enheter.

**Hvorfor:** Målt 2026-11-15 (gammel ordning): boligblokker og småhus har nok enheter i 7 av 8 kohorter, men skoler, kulturbygg, idrettsbygg og sykehus har ingen kohort med 10 enheter. Uten reserve ville ikke-boliger nesten aldri fått sammenligning. Byggets median alene skjuler spredning (halve bygget på A og halve på G ser middels ut). Grensen på 3 enheter hindrer at tallet i praksis beskriver én bolig.

## 2026-11-15: Adresse er med i enhetsnøkkelen
**Beslutning:** En enhet er bygningsnummer + bruksenhetsnummer + adresse.
**Hvorfor:** `sql-agent` fant at bruksenhetsnummer (f.eks. H0101) gjentas på hver inngang i samme bygg. Uten adresse ble ulike leiligheter slått sammen: 67 351 enheter i gammel ordning og 11 287 i ny. Med adresse blir det 108 107 og 13 429.

## 2026-11-15: Faglige regler avgjort
**Beslutning:**
- Enhet i statistikk er bruksenheten (bygningsnummer + bruksenhetsnummer), med siste attest per enhet.
- Ordning går på utstedelsesdato: før 2026-01-01 er gammel ordning, fra og med er ny.
- Kohorter etter byggtekniske forskrifter: før 1949, 1949–69, 1970–86, 1987–96, 1997–2006, 2007–16, 2017+.
- Minst 10 enheter i en kohort før sammenligning vises.

**Hvorfor:** Borettslag og sameier har én attest per leilighet, så bygning som enhet ville skjult forskjeller. Dataene viser at 2025-attester har oppvarmingskarakter og 2026-attester (fra 7. jan.) ikke har det, så datoskillet stemmer med dataene og krever ikke et eget felt. Forskriftene markerer når kravene til bygg endret seg. 10 er nok til å unngå de minste gruppene uten å skjule de fleste områder.

## 2026-11-13: Hovedsesjonen er orkestrator
**Beslutning:** Eieren og hovedsesjonen planlegger og fordeler arbeid; det finnes ingen egen orkestrator-agent.
**Hvorfor:** Subagenter kan ikke starte andre subagenter, og eieren vil ha innsyn og eierskap.
Arbeidet har tre godkjenningspunkter: plan, API-kontrakt og pull request.
