# Hovedsesjonen: norsk 400 for ugyldige tall i `api/enheter`

**Hva:** Et action-filter (`NorskParameterfeilAttribute` i `EnheterController.cs`) gjør ugyldige tall (`lat=abc`, `radius=x`) om til samme norske 400-tekst som den vanlige valideringen. Før fikk klienten en engelsk ProblemDetails fra ASP.NET. I tillegg er utdaterte tall i to gamle loggfiler merket og rettet, og løste punkter er strøket fra CLAUDE.md.

**Hvorfor:**
- `[ApiController]` stopper ugyldige tall før metoden kjøres, så `Valider` rekker aldri å svare. Filteret har `Order -3000` og kjører derfor før ASP.NETs `ModelStateInvalidFilter` (`-2000`).
- Filteret ligger bare på `EnheterController`. Forkastet: å endre `InvalidModelStateResponseFactory` globalt, fordi det ville endret 400-formatet for alle controllere.
- Bare første feil meldes, i praksis i rekkefølgen lat, lon, radius. Finnes ingen feil med tekst, slippes forespørselen videre i stedet for å gi 500 (reviewer-funn).
- Svaret er fortsatt HTTP 400 med en JSON-streng, som før for manglende verdier. Kontrakten (`docs/api-kontrakt.md`, «Ugyldige parametre gir HTTP 400») er ikke endret.

**Testet** (backend på port 5288 mot live-databasen):

| Kall | Svar |
|---|---|
| `punkter?lat=abc&lon=10.78&radius=500` | 400 «lat må være et tall mellom -90 og 90.» |
| `punkter?lat=59.9&lon=1e999x&radius=500` | 400 «lon må være et tall mellom -180 og 180.» |
| `punkter?lon=10.78&radius=500` (mangler lat) | 400 «lat må være et tall …» |
| `statistikk?…&radius=x` | 400 «radius må være et heltall mellom 1 og 20000 meter.» |
| `statistikk?…&radius=2.5` | 400, samme tekst |
| `punkter?…&ordning=feil` | 400 «ordning må være gammel, ny eller alle.» |

- Gyldige `punkter` og `statistikk` for Gamle Oslo har samme md5 som før endringen.
- `api/bygg-oversikt/abc` (en annen controller) svarer som før.
- Radiussøket i nettleseren (via Vite) viser «Søker etter enheter nær stedet …», «Finner enheter i nærheten innenfor 5 000 m …» og «200 enheter i nærheten (maks 200)».

**Usikkert:** Er flere tall ugyldige samtidig, får klienten bare melding om det første.

**Lær dette: filterrekkefølge i ASP.NET.** Før en controller-metode kjører, går forespørselen gjennom filtre sortert på `Order` (lavest først). `[ApiController]` legger inn et filter som svarer 400 ved ugyldige verdier. Et eget filter med lavere `Order` får se forespørselen først og kan svare selv. Slik endres feilformatet for én controller uten å røre resten.
