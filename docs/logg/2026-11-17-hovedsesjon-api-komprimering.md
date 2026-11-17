# Hovedsesjonen: komprimering av API-svar

**Hva:** `Program.cs` komprimerer nå svarene med Brotli eller gzip (det nettleseren ber om), for JSON, tekst og vektortiles. JSON-formatet er uendret, så API-kontrakten og frontend er ikke endret.

**Hvorfor:**
- Punktsvaret for en bydel var ca. 9,6 MB. GeoJSON gjentar de samme feltnavnene for hvert punkt og pakker seg derfor svært godt.
- Nivå `Fastest`: `Optimal` for Brotli bruker mye CPU på svar på flere MB, og gevinsten i størrelse er liten.
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
- I nettleseren (kartet, Gamle Oslo): 780 kB overført, 9,4 MB utpakket, og kartet viser klyngene som før.
- Tid lokalt er omtrent den samme (ca. 0,4–0,8 s etter første kall). Gevinsten er på nettverket: 0,8 MB i stedet for 9,6 MB.

**Usikkert:**
- Ikke målt over et tregt nett eller en tunnel, der gevinsten er størst.
- Komprimering bruker litt CPU per kall; svarene caches ikke komprimert.

**Lær dette: Content-Encoding.** Nettleseren sender `Accept-Encoding: gzip, br` og forteller hvilke pakkeformater den forstår. Serveren pakker svaret og svarer med `Content-Encoding: br`. Nettleseren pakker ut før JavaScript ser dataene, så `fetch` får nøyaktig samme JSON som før. Derfor trengte verken kontrakten eller frontend å endres.
