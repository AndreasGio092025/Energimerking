# Oversetter: Enkel bygg per enhet og per bygg

## Hva
Gikk gjennom all brukersynlig tekst i filene som ble endret for «Enkel bygg» (Filters.jsx, MapView.jsx, enheter.js, tileFilter.js, upgradeInsights.js, useStore.js, constants.js, api.js). Nesten alt var allerede naturlig bokmål; to tekster i `MapView.jsx` ble gjort tydeligere.

## Endrede strenger (fil for fil)
`Frontend/src/components/MapView.jsx`
- Popup for enhet, flere enheter på samme punkt: `{n} enheter her` -> `Antall enheter her: {n}` (sier tydelig at tallet er antall enheter).
- Pill over kartet i «Enkel bygg»: `Viser bygg (median for enhetene), ...` -> `Viser ett punkt per bygg (median for enhetene), ...`, og `Viser enheter, ...` -> `Viser ett punkt per enhet, ...` (samme ordbruk som valget «Hva hvert punkt viser»).

Ingen andre filer er endret. Sjekket og funnet i orden (ingen endring):
- Filters.jsx: «Enkel bygg», «Per enhet»/«Per bygg», «Hva hvert punkt viser», «Energimerkeordning», forklaringene og filternotene. «Beregnet levert energi» brukes riktig. Ingen «energibehov/energibruk/forbruk» i tekst brukeren ser (`energibruk_kwh_m2` er et internt feltnavn og er urørt).
- MapView.jsx: byggpopup (Median, Antall enheter, Byggeårsgruppe, Ordning), hjelpetekstene og «Zoom inn for å se byggene/enhetene».
- enheter.js: ordningsnavn («Gammel ordning (før 2026)», «Ny ordning (fra 2026)»).
- upgradeInsights.js: tekstene og kohortnavn.
- Filene i `dev/` er hoppet over, som avtalt.

## Hvorfor
Frontend-agenten hadde skrevet norsk fra start, så jobben var å stramme inn ordbruk. Forkastet: å endre «Enkel bygg» (det er navnet på visningen i kartmodusene) og «Median» (er forklart i hjelpeteksten).

## Testet
- `npm ci` og `npm run build` i `Frontend`: grønn (vite, bygget på ca. 9 s; bare vanlig advarsel om store chunks).
- `Frontend/dist` tilbakestilt og ryddet, ikke committet.
- Ikke sjekket visuelt i nettleseren; endringene er to korte tekster.

## Usikkert
- `TILE_HEATING_GRADES` i Filters.jsx inneholder API-verdier (`Green`, `Red` ...) som vises via `heatingGradeName`; ikke endret.
- Tekster i `dev/`-filene er ikke vasket.

## Lær dette
Skillet mellom tekst brukeren ser og verdier koden bruker: `Green`/`RED` og feltnavn som `energibruk_kwh_m2` er data og kontrakt, og må aldri oversettes. Bare strengen som vises (via f.eks. `heatingGradeName`) oversettes.
