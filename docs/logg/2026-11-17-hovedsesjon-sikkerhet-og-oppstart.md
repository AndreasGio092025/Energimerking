# Hovedsesjonen: sikkerhet og oppstart fra tom maskin

**Hva:** Postgres og pgAdmin lytter bare på `127.0.0.1`, passord leses fra en lokal `Backend/Docker/.env`, Vite lytter på `localhost`, og Postgres er låst til `postgis/postgis:17-3.5`. Compose har fått en healthcheck, og README beskriver oppbygging fra tom maskin og ny import.

**Hvorfor:**
- Før lyttet database og pgAdmin på alle nettverkskort (`0.0.0.0`) med passord som står i repoet, så andre på samme nettverk kunne logge inn som superbruker. `127.0.0.1` stenger det uten å endre noe for deg selv.
- Den hardkodede Cloudflare-adressen i `vite.config.js` er byttet med `VITE_ALLOWED_HOSTS`, så tunnelen kan slås på når den trengs.
- `.env.example` har de samme utviklingsverdiene som før (de står også i `appsettings.json`). Målet er at ekte passord aldri havner i Git, ikke å skjule utviklingspassordet.
- Healthcheck: feiler init, starter Docker databasen på nytt halvtom uten å prøve init igjen (reviewer-funn). Containeren blir nå `unhealthy` i stedet for å se ferdig ut. Forkastet: `restart: "no"` (da starter ikke databasen etter omstart av PC).
- Versjonslås: `latest` kan bli PostgreSQL 18, som har flyttet datamappen. Live og testene kjører 17.5 / PostGIS 3.5.2.
- Hele `Backend/Docker/Data/` er ignorert (unntatt `.gitkeep`), så ingen dump eller CSV med adresser kan committes ved et uhell.

**Testet:** `docker compose` med repoets compose-fil i to midlertidige prosjekter (`energitest` på 5433 med dump, `energitest2` på 5434 uten dump), se resultat nederst. Live-containeren ble ikke rørt.

Resultat:
- Med dump: `healthy` etter ca. 2 min, 108 107 enheter i gammel og 13 429 i ny ordning (som live), PostgreSQL 17.5.
- Uten dump: loggen viser «FEIL: Fant ikke grunndata-dumpen», Docker startet databasen på nytt med «Skipping initialization», og containeren ble `unhealthy`, som tiltenkt.
- Begge testprosjektene og volumene deres er slettet etterpå.

**Usikkert:**
- Live-databasen kjører fra en annen mappe (`Documents\DockerEnergimerke`) og lytter fortsatt på `0.0.0.0`. Endringen her virker først når live flyttes til repoets compose, eller portene rettes i den mappen.
- Taggen `17-3.5` er ikke hentet ennå (testen brukte det lokale `latest`-imaget, som er 17.5 / 3.5.2).

**healthcheck.** Docker kan kjøre en kommando i containeren med jevne mellomrom og merke den `healthy` eller `unhealthy`. «Kjører» betyr bare at prosessen lever; `healthy` betyr at den faktisk virker. Her sjekker vi at siste view fra `db-init` finnes, altså at hele oppbyggingen gikk gjennom.
