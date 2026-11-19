# SQL-agent: vektor-tiles «Enkel bygg» per enhet og per bygg

**Hva:** Ny fil `Backend/Docker/db-init/10_enkel_bygg_tiles.sql` med `mv_enhet_bygg_punkt` (ett punkt per bygg og ordning), utvidet `refresh_enheter_kart()` og funksjonen `enkel_bygg_tile(z, x, y, visning, ordning)`. `03_tile_functions.sql` (`custom_ST_GetPoints`, ett punkt per attest) er slettet; 05 og 08 har bare fått oppdaterte kommentarer om rekkefølgen ved ny kjøring.

**Hvorfor:**
- Signatur og rekkefølge matcher `TileService.GetTileAsync` i commit 4ead220 (`SELECT enkel_bygg_tile(@z, @x, @y, @visning, @ordning)`), og feltene følger kontrakten i `docs/api-kontrakt.md`.
- Enhetslaget leser `mv_enhet_punkt` (siste attest per enhet og ordning). Gammel og ny ordning blandes aldri: hver tile har ett `ordning`-filter, og byggviewet grupperer per `(bygningsnummer, ordning)`.
- Byggviewet er materialisert, fordi median og midtpunkt over 120 000 enheter ville tatt sekunder per tile. Kategori, byggeår og kohort (`byggeaar_kohort()`) tas fra byggets siste attest, som i `bygg_oversikt_json`; grensene er ikke gjentatt.
- `median_karakter` er element `floor(n/2)+1` av karakterene sortert A til G. Det gir midten ved oddetall og den dårligste av de to midterste ved partall. `median_kwh_m2` er `percentile_cont(0.5)`.
- Utvalget gjøres med `ST_Intersects` mot tile-firkanten omregnet til 25832 (kantene delt opp med `ST_Segmentize`) FØR taket (5000 under zoom 13, ellers 8000), sortert på id/bygningsnummer. Forkastet: ren boks-test (`&&`), som tok med punkter utenfor tilen, fylte taket og ga for få punkter.
- Sletting av 03 er trygg: `grep` i Backend/ og Frontend/ viser at bare gamle `TileService.cs` (på master) kalte `custom_ST_GetPoints`, og den er byttet ut i 4ead220. Sletting må altså følge med at den grenen merges. Gammelt objekt `custom_ST_GetPoints` ligger fortsatt i live-DB-en (ikke droppet).
- Personvern: feltlisten er skrevet ut med navn. Ingen attestnummer, bruksenhetsnummer eller `enhet_id`; `id` er hashen fra `mv_enhet_punkt`. Kontrollert ved å lete etter strengene i tile-bytene.
- Filen er gyldig UTF-8 (`file` melder UTF-8 uten feil). Den har LF mens de fleste andre db-init-filer har CRLF; det har ingen betydning for psql.

**Testet** (live-DB `energimerke-db`, hele 10-filen kjørt på en DB som allerede hadde objektene, dvs. omkjøring OK, 2,6 s):
- `SELECT refresh_enheter_kart();` 40,8 s. `mv_enhet_punkt` 121 536 rader (gammel 108 107, ny 13 429). `mv_enhet_bygg_punkt` 21 053 rader (gammel 15 470 bygg / 108 055 enheter, ny 5 583 bygg / 13 398 enheter). Ingen rader uten punkt.
- Tiles z=14 (kjøretid for alle 12 kall til sammen 384 ms): enheter/gammel x=8685,y=4765: 168 322 byte; x=8686: 96 252; enheter/ny: 3 447 og 7 816; bygg/gammel: 11 353 og 18 121; bygg/ny: 2 218 og 2 186. Tile 8687/4766 (utenfor bebyggelse) er tom (0 byte) for alle fire kombinasjoner. z=9 gir tom tile. Tile 8685/4765 har 2 541 enheter i utvalget (under taket).
- z=12 enheter/gammel: 375 837 byte med tak, 1 142 904 byte uten tak (558 ms): taket virker.
- Ugyldig visning (`foo`, NULL), ugyldig ordning (`alle`) og ugyldig tile (x=99999) gir feil med SQLSTATE 22023 og norsk tekst.
- Stikkprøver mot `mv_siste_attest_per_enhet`: bygg 300612072 (gammel, 41 enheter: 21 B, 16 C, 4 D, median B, 107,5 kWh/m², 2 adresser), bygg 300139314 (gammel, 79 enheter, median D, 158,6) og bygg 300844537 (ny, 1 enhet, B, 95,7) stemmer med rådata på antall, medianer og antall adresser.

**Usikkert:**
- Testcontainer `energimerke-tmp-sqltest` er ikke brukt; alt kjørt mot live (additivt, bare nye objekter). Ren installasjon fra tom DB er ikke kjørt.
- `refresh_enheter_kart()` tar ca. 41 s; hvor mye av det som er det nye viewet er ikke målt (selve viewet bygges på under 1 s).
- Gamle seksjoner i `docs/api-kontrakt.md` nevner fortsatt `03_tile_functions.sql`; de er merket som erstattet, men kan ryddes av hovedsesjonen.
- Byggets kategori/byggeår er felles for begge ordninger i samme bygg (siste attest uansett ordning); eieren bør bekrefte at det er ønsket.
- API-et er ikke kjørt ende-til-ende (C# er ikke i denne grenen).

**Lær dette:** *Materialisert view med romlig indeks.* Tunge utregninger (median, midtpunkt) gjøres én gang per import i et materialisert view, og en GiST-indeks på punktkolonnen gjør at hver tile bare leser byggene innenfor tilen. Tile-kallet blir da en rask kartspørring i stedet for en gruppering over alle enheter.
