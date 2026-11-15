# Frontend: «Enkel bygg» bruker vektor-tiles

Dato: 2026-11-15. Gren: `frontend-vektortiles-agent` (fra commit 308e427; worktreen sto på 084cca5 og ble flyttet dit med ny gren).

## Hva
Visningen «Enkel bygg» (tiles) henter nå byggpunkter som vektor-tiles fra `GET /tiles/{z}/{x}/{y}.pbf` i stedet for sidevis GeoJSON. Hele den gamle lastelogikken (rutenett, cache, avbryting, sammenslåing) er fjernet, og kartet gjør jobben selv.

Endret:
- `Frontend/src/components/MapView.jsx`: `energy-tiles` er nå en `vector`-kilde (`minzoom` 14, `maxzoom` 15), laget har `source-layer: "points"`, og fargen går fortsatt på `energikarakter`. Laveste zoom er 14 (var 12); velger brukeren visningen eller en bydel på lavere zoom, zoomer kartet inn til 14. Under 14 vises meldingen «Zoom inn for å se byggene». Kilden og lagene legges inn på nytt etter bytte av lys/mørk kartstil (via den eksisterende `addMapLayers`).
- `Frontend/vite.config.js`: proxy for `/tiles` til samme mål som `/api`.
- `Frontend/src/services/api.js`: `fetchTilePointsBounds` fjernet.
- `Frontend/src/utils/tilePoints.js`: slettet (ingen andre brukte den).
- Popup: klikk bruker fortsatt `fetchTilePointDetails(id)` med `id` fra tile-egenskapen. Den første, raske popupen (før detaljene er hentet) oversetter tile-feltene `energy` og `attestNr` til de navnene popupen allerede leser.

## Hvorfor
- Vektor-tiles lar nettleseren og kartet hente, bufre og tegne bare det som er synlig. Det erstatter ca. 870 linjer med egen cache- og rutenettkode (760 i `MapView.jsx`, 107 i `tilePoints.js`, 4 i `api.js`).
- Laveste zoom 14 (rettet etter reviewer): backenden tar med maks 5000 punkter per tile under zoom 13 og 8000 ellers, sortert på `id`. Målt mot lokal database viser zoom 10 bare 5 % av byggene (43 av 145 gårdsnumre), zoom 12 ned til 14 % og zoom 13 ca. 50 % i sentrum, i klumper. Fra zoom 14 har den tetteste tilen 5229 bygg, under taket, så alle bygg vises.
- `maxzoom` 15: over 15 strekker kartet tilene fra 15 (maks ca. 2800 bygg) i stedet for å hente nye per zoomnivå. Færre og mindre kall.
- Forkastet: å la backenden velge et jevnt romlig utvalg på lav zoom. Gir oversikt over hele byen, men er en større SQL-endring; kan gjøres senere.
- «Laster»-pillen for tiles er fjernet: det finnes ikke lenger en egen innlasting å vise, og kartet viser punktene etter hvert som tilene kommer.
- Kartlaget bruker fortsatt nåleikonene (symbol-lag) som før, ikke sirkler, så utseendet er uendret.
- Nedtrekk-fallbacken som henter detaljer via bounds (hvis id mangler) er beholdt uendret.

## Testet
- `npm run build` i `Frontend/`: går uten feil (vite 6.4.2, 54 moduler).
- Backend (`dotnet run`, profil http) og `npm run dev` startet fra worktreen, mot Docker-databasen `energimerke-db`.
- `curl` gjennom Vite-proxyen: `/tiles/13/4340/2381.pbf` gir 200 og ca. 640 KB, 1,1 s første gang (0,3 s senere); `/tiles/12/2170/1190.pbf` gir 200 og ca. 450 KB. En tile uten punkter (z13, 4340/2377) gir 204.
- Nettleser (Browser-panelet i Claude, ikke Playwright, se Usikkert):
  - Velger «Enkel bygg» på lav zoom: kartet zoomet inn til ca. 10. Skjermbildet `…-pc-zoom10.jpg` viser at nålene da lå i klumper og sentrum var nesten tomt (taket i backend). Det er grunnen til at laveste zoom nå er 14. Skjermbildet viser den gamle oppførselen.
  - Klikk på en nål: popup med detaljer (adresse, energikarakter F, 221,42 kWh/m², byggeår 1949) hentet via `GetTilePointDetails`.
  - Bytte til mørk kartstil: punktene og popupen beholdes.
  - Mobilbredde 375 px: punktene vises og kartet er brukbart.
- Skjermbilder i `docs/logg/`:
  - `2026-11-15-vektortiles-pc-zoom10.jpg`
  - `2026-11-15-vektortiles-pc-popup.jpg`
  - `2026-11-15-vektortiles-pc-morkt.jpg`
  - `2026-11-15-vektortiles-mobil-375.jpg`
- Backend og dev-server er stoppet.

## Usikkert
- **Playwright er ikke installert** i prosjektet, og jeg lastet ikke ned nettlesere uten tillatelse. Skjermbildene er tatt med Claudes innebygde nettleserpanel. Bygg-siden/utskrift (PDF) er ikke berørt av denne endringen og er ikke testet på nytt.
- **Tile-størrelse:** målt 400-740 KB ved zoom 12-13. Den tetteste tilen på zoom 14 (8682/4764, 5229 bygg) er 495 KB, nå med alle byggene; de fleste zoom 14-tiles har langt færre. Backenden har verken komprimering eller `Cache-Control`; mulig tiltak der, ikke gjort her.
- **Ingen oversikt over hele byen** i «Enkel bygg» under zoom 14; brukeren må zoome inn. Jevnt utvalg i backend kan gi oversikt senere.
- Skjermbildene er tatt før zoom-rettelsen og viser zoom 10 (se Testet).
- Rett etter klikk flyr kartet til punktet (eksisterende oppførsel i `selectedFeature`); popupen kommer et øyeblikk senere.
- Synlig tekst i legenden for tiles («Tile-mode building points» osv.) er fortsatt engelsk; det hører til `oversetter`, ikke denne oppgaven.
- Gamle tile-egenskaper (`energibruk_kwh_m2`) leses fortsatt som reserve i popupen; tile-feltet `energy` har forrang bare når det eldre feltet mangler.

## Lær dette
**GeoJSON-kilde vs. vektor-tile-kilde i MapLibre.** En GeoJSON-kilde er én samlet datafil (eller JSON-objekt) som nettleseren laster helt og selv deler opp i tiles internt; det betyr at appen må hente alle punkter, holde dem i minnet og kalle `setData` hver gang noe endres. Det blir tungt når det er titusenvis av punkter, og det var derfor vi hadde bygd egen sidevis henting og cache. En vektor-tile-kilde peker i stedet på en URL-mal (`/tiles/{z}/{x}/{y}.pbf`): kartet ber selv om akkurat de rutene som er synlige ved gjeldende zoom, bufrer dem og kaster dem når de ikke trengs. Serveren gjør utvalget (her i SQL), og stilen velger hvilket «lag» i tilen som tegnes (`source-layer`, her `points`). Resultatet er mindre kode i nettleseren og jevnere ytelse, men all begrensning og utvalg må skje i backend.
