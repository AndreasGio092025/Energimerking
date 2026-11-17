# Hovedsesjonen: komprimering av API-svar

**Hva:** `Program.cs` komprimerer nå svarene med Brotli eller gzip (det nettleseren ber om), for JSON, tekst og vektortiles. JSON-formatet er uendret, så API-kontrakten og frontend er ikke endret.

**Hvorfor:**
- Punktsvaret for en bydel var ca. 9,6 MB. GeoJSON gjentar de samme feltnavnene for hvert punkt og pakker seg derfor svært godt.
- Nivå `Fastest`: `Optimal` for Brotli er kjent for å bruke mye CPU på svar på flere MB. At gevinsten i størrelse er liten, er en antakelse (ikke målt); `Fastest` gir allerede 8,3 %.
- `EnableForHttps`: trygt fordi svarene ikke har innlogging, tokens eller andre hemmeligheter (BREACH-angrep krever det).
- Forkastet foreløpig: lavere tak eller færre felter i punktsvaret. Det krever ny kontrakt og trengs ikke når svaret er under 1 MB på nettet.

**Testet** (Gamle Oslo, lat 59.9056, lon 10.7867, radius 2300, gammel ordning; backend på egen port 5288 mot live-databasen):

| Svar | Før | Etter (Brotli) | Etter (gzip) |
|---|---|---|---|
| `api/enheter/punkter` | 9 646 721 byte | 798 835 byte (8,3 %) | 805 091 byte (8,3 %) |
| Vektortile 14/8682/4766 | 233 444 byte | 119 318 byte (51 %) | |
| `api/enheter/statistikk` | 1 312 byte | uendret innhold | |

- Utpakket innhold er byte-for-byte likt (samme md5) for punkter, tile og statistikk.
- Uten `Accept-Encoding` får klienten ukomprimert svar som før.
- Ugyldige parametre gir fortsatt 400.
- I nettleseren (kartet, Gamle Oslo), gjennom Vite-proxyen (`VITE_API_PROXY_TARGET=http://localhost:5288`, Vite på 5174): 780 kB overført, 9,4 MB utpakket, og kartet viser klyngene som før. Proxyen slipper altså komprimerte svar gjennom.

**Også gjort i denne økten (utenfor repoet):** live-databasen kjører fra `Documents\DockerEnergimerke`. Der ble portene endret til `127.0.0.1:5432` og `127.0.0.1:8080` og containerne laget på nytt med samme volumer, etter full dump til `DockerEnergimerke\Data\full-2026-11-17.dump`. Sjekket: begge porter lytter bare på `127.0.0.1`, svarer lokalt og er stengt mot nettverksadressen; 108 107 / 13 429 enheter og samme salt som før. Derfor er advarselen i CLAUDE.md skrevet om.
- Tid lokalt er omtrent den samme (ca. 0,4–0,8 s etter første kall). Gevinsten er på nettverket: 0,8 MB i stedet for 9,6 MB.

**Usikkert:**
- Ikke målt over et tregt nett eller en tunnel, der gevinsten er størst.
- Komprimering bruker litt CPU per kall; svarene caches ikke komprimert.

**Lær dette: Content-Encoding.** Nettleseren sender `Accept-Encoding: gzip, br` og forteller hvilke pakkeformater den forstår. Serveren pakker svaret og svarer med `Content-Encoding: br`. Nettleseren pakker ut før JavaScript ser dataene, så `fetch` får nøyaktig samme JSON som før. Derfor trengte verken kontrakten eller frontend å endres.
