# Energimerking

Energimerking er en webapplikasjon for å utforske energimerker for bygg i Oslo. Prosjektet består av en React/Vite-frontend, en .NET Web API-backend og en PostgreSQL/PostGIS-database.

Applikasjonen viser bygg i kart, lar brukeren filtrere på byggeår, energibruk, energikarakter og oppvarmingskarakter, og henter bydelsstatistikk fra lokale databasedata og eksterne kilder.

## Innhold

- Kartvisning med MapLibre
- Markør-, heatmap-, tile- og oppgraderingsvisning
- Søk etter adresser/enheter i innlastede byggdata
- Radius-søk ved klikk i kartet
- Filter for byggeår, energibruk, energikarakter og oppvarmingskarakter
- Bydelsstatistikk for Oslo
- Swagger for backend-API
- Docker-oppsett for PostGIS og pgAdmin

## Teknologistack

### Frontend

- React 19
- Vite
- MapLibre GL
- Zustand
- Framer Motion
- Lucide React

### Backend

- .NET 10
- ASP.NET Core Web API
- Entity Framework Core
- Npgsql
- NetTopologySuite
- Swagger / Swashbuckle

### Database

- PostgreSQL
- PostGIS
- pgAdmin

## Prosjektstruktur

```text
.
├── Backend/
│   ├── Core/              # EF Core-modeller, DbContext og domenetjenester
│   ├── Docker/            # Docker Compose og databasefiler
│   └── WebApi/            # ASP.NET Core API
├── Frontend/              # React/Vite-applikasjon
├── Energimerking.sln      # Visual Studio/.NET solution
└── README.md
```

## Forutsetninger

Installer dette før du kjører prosjektet lokalt:

- Docker Desktop
- .NET 10 SDK
- Node.js og npm

## Lokal oppstart

Kjør kommandoene fra rotmappen i repoet hvis ikke annet er oppgitt.

### 1. Start database

Databasen bygges fra filene i `Backend/Docker/db-init/` pluss én datafil, `grunndata.dump`.
Datafila ligger **ikke** i Git (den er stor og deles direkte, f.eks. via Google Drive). Spør
prosjekteieren om den.

1. Legg `grunndata.dump` i `Backend/Docker/Data/`.
2. Lag din egen `.env` med brukernavn og passord (fila ligger ikke i Git):

   ```powershell
   cd Backend\Docker
   Copy-Item .env.example .env
   ```

3. Start databasen:

   ```powershell
   docker compose up -d
   ```

4. Første gang (tomt databasevolum) leser Postgres inn dumpen og kjører SQL-filene i
   `db-init/` i navnerekkefølge. Det tar noen minutter. Følg med til den er klar:

   ```powershell
   docker logs -f energimerke-db
   ```

   Vent til siste linje er `database system is ready to accept connections` etter at init-skriptene er ferdige.
   Mangler `grunndata.dump`, stopper oppstarten med en melding om det.

Dette starter:

- PostgreSQL/PostGIS på `localhost:5432`
- pgAdmin på `http://localhost:8080`

Begge er bare tilgjengelige fra din egen maskin (`127.0.0.1`), ikke fra andre på nettverket.
Brukernavn og passord står i `.env` (standardverdier i `.env.example`).

Postgres leser `db-init/` og `.env` bare når databasevolumet er tomt. For å bygge databasen helt
på nytt (sletter alle data i volumet):

```powershell
docker compose down -v
docker compose up -d
```

### Ny import av data

Etter at du har lastet inn nye attester eller annen grunndata:

1. Oppdater kart og statistikk (ellers viser appen forrige import):

   ```powershell
   docker exec energimerke-db psql -U Kodehode -d Energimerking -c "SELECT refresh_enheter_kart();"
   ```

2. Lag en ny `grunndata.dump` og legg den på Google Drive i stedet for den gamle:

   ```powershell
   docker exec energimerke-db pg_dump -U Kodehode -d Energimerking -Fc --no-owner --no-privileges -t public.bygning -t public.coordinates -t public.coordinates_raw -t public.denorm_matrikkel_og_enova_oslo -t public.eiendom -t public.eiendom_bygning -t public.energiattester -t public.energikarakter -t public.energimerke -t public.enova_raw -t public.kommune -t public.oppvarmingskarakter -f /tmp/grunndata.dump
   docker cp energimerke-db:/tmp/grunndata.dump Backend\Docker\Data\grunndata.dump
   ```

   Kjør den andre kommandoen fra rotmappen i repoet.

### 2. Start backend

Fra rotmappen:

```powershell
dotnet restore Energimerking.sln
dotnet run --project Backend\WebApi\WebApi.csproj
```

Backend kjører normalt på:

```text
http://localhost:5277
```

Swagger er tilgjengelig på:

```text
http://localhost:5277/swagger
```

Backend bruker denne connection stringen fra `Backend/WebApi/appsettings.json`:

```text
Host=localhost;Port=5432;Database=Energimerking;Username=Kodehode;Password=12345
```

Du kan overstyre den med miljøvariabel:

```powershell
$env:ConnectionStrings__Postgres="Host=localhost;Port=5432;Database=Energimerking;Username=Kodehode;Password=12345"
```

### 3. Start frontend

I en ny terminal:

```powershell
cd Frontend
npm install
npm run dev
```

Frontend kjører normalt på:

```text
http://localhost:5173
```

Vite-proxyen sender `/api`-kall videre til backend på `http://localhost:5277`.

Hvis backend kjører på en annen adresse, kan proxyen overstyres slik:

```powershell
$env:VITE_API_PROXY_TARGET="http://localhost:5277"
npm run dev
```

## Viktige API-endepunkter

Backend eksponerer blant annet:

```text
GET  /api/bygg/GetNearbyDeNormGeoJson
GET  /api/bygg/GetNearbyDeNormDynamicList
GET  /api/bygg/nearby
GET  /api/bygg/nearby/geojson
POST /api/bygg/refresh
GET  /api/bydel-stats/{bydelId}
```

Eksempel:

```text
http://localhost:5277/api/bygg/GetNearbyDeNormGeoJson?latitude=59.9&longitude=10.8&radiusInMeters=2500&amount=100&onlyNew=false
```

## Miljøvariabler

### Backend

```text
ConnectionStrings__Postgres
NOBIL_API_KEY
```

`NOBIL_API_KEY` er valgfri. Uten den returnerer backend fortsatt bydelsstatistikk, men ladestasjonstall fra NOBIL blir ikke fylt ut.

### Frontend

```text
VITE_HOST
VITE_PORT
VITE_API_PROXY_TARGET
VITE_HMR_HOST
VITE_HMR_CLIENT_PORT
VITE_ALLOWED_HOSTS
```

Vite lytter bare på `localhost` som standard. Sett `VITE_HOST=0.0.0.0` for å åpne for andre på
nettverket, og `VITE_ALLOWED_HOSTS` (kommaseparert) for ekstra vertsnavn, f.eks. en Cloudflare-tunnel.

## Bygg

Frontend:

```powershell
cd Frontend
npm run build
```

Backend:

```powershell
dotnet build Energimerking.sln
```

## Datakilder

Prosjektet bruker lokale energimerke-, matrikkel- og koordinatdata i PostGIS. Bydelsstatistikk hentes også fra:

- Oslo statistikkbank
- SSB Statbank API
- NOBIL, hvis API-nøkkel er satt

Kartbakgrunner lastes fra Carto basemap-URL-er, så frontend trenger internett-tilgang for at bakgrunnskartet skal vises.

## Feilsøking

### Frontend viser "No backend data loaded"

Sjekk at:

- databasen kjører på `localhost:5432`
- backend kjører på `http://localhost:5277`
- `VITE_API_PROXY_TARGET` peker til riktig backend
- databasen inneholder data i tabellene/viewene API-et leser fra

### API-et får databasefeil

Sjekk connection string i `Backend/WebApi/appsettings.json`, og bekreft at Docker-containeren `energimerke-db` kjører:

```powershell
docker ps
```

### pgAdmin får ikke koblet til databasen

Bruk disse verdiene når du registrerer serveren i pgAdmin:

```text
Host:     postgis
Port:     5432
Database: Energimerking
Username: Kodehode
Password: 12345
```

Når du kobler fra maskinen utenfor Docker-nettverket, bruk `localhost` som host.

## Notater

- Passordene i Docker-oppsettet er utviklingsverdier og bør ikke brukes i produksjon.
- `Frontend/dist` er en bygget frontend-versjon og kan regenereres med `npm run build`.
- Det ser ikke ut til å være egne testkommandoer konfigurert i repoet per nå.
