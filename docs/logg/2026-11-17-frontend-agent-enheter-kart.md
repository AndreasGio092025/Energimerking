# 2026-11-17 frontend-agent: enheter i kartet

**Hva:** Bydelsvisningen (klynger, varmekart, radius-søk) henter nå ett punkt per enhet fra `api/enheter/punkter`, med et valg mellom «Gammel ordning (2025)» og «Ny ordning (fra 2026)». Statistikkpanelet viser tallene fra `api/enheter/statistikk` i stedet for å regne dem i nettleseren.

**Hvorfor:**
- Kartet viser én ordning om gangen (standard gammel, `alle` brukes aldri), siden karakterene ikke er samme skala. Valget ligger under «Bydeler i Oslo» i panelet.
- Utvalget «siste attest per enhet» er fjernet fra nettleseren: `getLatestCertificateFeatures`, nøkkelfunksjonene i `filtering.js` og `latestOnly` i store er slettet. Databasen gjør jobben.
- `buildBydelStats`, `median`, `countBy`, `mostCommon` og prosentregningen i `Filters.jsx` er slettet. «Før 1980» og «Høy oppgraderingsprioritet» er borte; kohortfordelingen fra API-et erstatter dem.
- Panelet sier at området er en sirkel («innenfor X km fra midten av bydelen»), at filtrene ikke påvirker tallene, og viser «N enheter i ordningen har ikke kartpunkt og er ikke med» når `enheter_uten_kartpunkt` > 0.
- Nytt `utils/enheter.js` gjør svaret fra API-et om til kartpunkter. Det legger bare til de gamle feltnavnene (`energibruk_kwh_m2`, `certificateScheme`) som filtre og oppgraderingsprioritet allerede leser. Ingen nye felter er funnet på.
- Popup for punkt: adresse, energikarakter, beregnet levert energi (kWh/m² per år), byggeår, ordning, bygningskategori, byggeårsgruppe (kohort), utstedelsesdato, oppvarming (bare gammel), «N enheter her» når `antall_enheter_samme_punkt` > 1, og «Vis bygget» til `#/bygg/{bygningsnummer}`.
- `avkortet` vises som en kort melding i kartet og ordningen vises i en liten merkelapp i kartet.
- Oppgraderingsprioritet brukte de gamle dataene (samme `allFeatures`). Den bruker nå punktene fra den nye ruten, alltid gammel ordning (uavhengig av valget i panelet). Merkelappen i kartet sier «Viser Gammel ordning (2025)».
- Forkastet: å la filtrene også styre statistikken (ville blandet «API-tall for hele området» og «filtrerte punkter»). I stedet står det tydelig i panelet.
- Testdata: `Frontend/src/dev/enheter-eksempel.js` lager oppdiktede punkter og statistikk etter kontrakten («Eksempelveien»). De brukes bare med `?eksempel=enheter` (`?eksempel=enheter-avkortet` for å se taket-meldingen), vises med et gult bånd øverst, og er aldri reserve: uten parameteren gir en API-feil en vanlig feilmelding.
- Fjernet døde API-funksjoner `fetchBuildingsGeoJson` og `fetchNearbyBuildingsGeoJson`. `normalizeGeoJson` beholdes, fordi «Enkel bygg» (tiles) bruker den.
- Liten rettelse i `MapView.jsx`: hvis dataene er hentet (f.eks. fra hurtigbufferen) før kartet er ferdig lastet, ble punktene ikke satt inn. Nå settes de inn på nytt når kartet er i ro (`map.once("idle", ...)`).

**Testet:**
- `npx vite build --outDir <midlertidig mappe>` går uten feil (bare vanlig advarsel om stor fil).
- `npm run dev` med `?eksempel=enheter` i Claudes nettleserpanel: klynger, ordningsvalg gammel/ny (563 mot 159 enheter i Gamle Oslo), statistikkpanel (alle felt, «37 enheter ... ikke kartpunkt»), popup for enkeltpunkt med «Vis bygget» (`#/bygg/117431375`), punkt med flere enheter (liste, og «4 enheter her» etter valg), radius-søk (30 enheter innen 500 m), melding om avkortet (`enheter-avkortet`), Oppgraderingsprioritet (laster gammel ordning selv om «ny» er valgt), og 375 px bredde (panelet og statistikken). Skjermbildene ble sett i panelet; ingen filer lagret.
- **Ikke testet mot ekte API.** Rutene fantes ikke ennå. Formen på svaret er bare sjekket mot kontrakten og mine egne testdata.
- Ikke testet: varmekart-visning med testdata, «Enkel bygg» etter endringen (koden er urørt, men ikke åpnet), bygg-siden og utskrift (urørt), mørkt tema.

**Usikkert:**
- Kohortnøklene sorteres slik API-et leverer dem (bare «ukjent» legges sist). Lagres de i `jsonb`, kan rekkefølgen bli feil (jsonb sorterer nøkler etter lengde, så alfabet). SQL-siden bør levere dem i fast rekkefølge, eller kontrakten bør si hvordan de sorteres.
- Antall kohorter og tekstene deres («før 1949», «1949–1969» osv.) er gjettet i testdataene. Panelet skriver «Bygget {kohort}» rett fra API-et.
- Oppvarmingskarakteren kommer som `LightGreen` (kontrakten). Oppgraderingsanslaget gir `LightGreen` nøytral poengsum (50) fordi den gamle tabellen bare kjenner GREEN/YELLOW/ORANGE/RED. Det var slik før også; bør avgjøres faglig.
- Punkter uten energi (`energi_kwh_m2` null) passerer energifilteret (som før) og vises som «Mangler» i popup.
- Når 50 000-taket nås, vises bare en melding. Det finnes ikke «zoom inn og hent mer».
- Statistikken hentes én gang per bydel (ikke ved ordningsbytte), siden svaret har begge ordningene.
- Søkefeltet søker bare i adresser fra punktene som er lastet (ikke poststed/kommune, som ikke finnes i kontrakten).
- Listen «Enheter på stedet» (flere punkter på samme koordinat) vises uten enhetsnummer, siden kontrakten ikke har bruksenhetsnummer.

**Lær dette:** Statistikk bør regnes i databasen, ikke i nettleseren, fordi nettleseren bare ser de punktene den har lastet (her et tak på 20 000 attester og bare ett utvalg). Tallene ble derfor feil og kunne ikke stå for «hele bydelen». Databasen ser alle rader, teller enhetene riktig (én per enhet, ikke per attest) og bruker samme kohortgrenser og regler som resten av systemet. Da får alle som ser tallene det samme svaret, og frontend slipper å gjette hvilke regler som gjelder.
