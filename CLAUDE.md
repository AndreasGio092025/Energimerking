# Energimerking

Webapplikasjon for å utforske energimerker for bygg i Oslo: React/Vite-frontend (`Frontend/`),
.NET Web API (`Backend/WebApi/`, `Backend/Core/`) og PostgreSQL/PostGIS (`Backend/Docker/`).
Se `README.md` for oppsett og kjøring.

## Mapper og eiere
- `Backend/Docker/db-init/`: SQL (`sql-agent`)
- `Frontend/src/`: frontend (`frontend-agent`); tekststrenger også `oversetter`
- `docs/`: API-kontrakt, beslutninger og agentlogg

## Faglige regler
Bindende fra 2026-11-15 (avgjort av eieren, se `docs/beslutninger.md`).

**Enheter vs attester**
- En attest (`Attestnummer`) er én utstedelse fra Enova. En bruksenhet kan ha flere attester over tid.
- Enheten i statistikk er **bruksenheten** (leiligheten), identifisert med bygningsnummer + bruksenhetsnummer + adresse (`enhet_id` i `v_attester`). Adressen må med fordi samme bruksenhetsnummer (f.eks. H0101) går igjen på hver inngang i et bygg. Uten bruksenhetsnummer er enheten bygningsnummer + adresse.
- Statistikk teller *enheter*, ikke attester: bruk siste attest per enhet (høyeste utstedelsestidspunkt), som i `mv_siste_attest_per_enhet`.
- Skriv alltid i tekst og API om et tall er "antall enheter" eller "antall attester".

**Ordning blandet**
- Energimerkeordningen endres i 2026. Karakterer fra gammel og ny ordning er ikke samme skala.
- **Gammel ordning:** utstedt før 2026-01-01. **Ny ordning:** utstedt 2026-01-01 eller senere. Skillet går på `Utstedelsesdato`, ikke på tabell eller kilde.
- Bland aldri gammel og ny ordning i samme gjennomsnitt, fordeling eller sammenligning. Vis dem hver for seg, eller bruk overgangsnøkkelen når den finnes.
- Alle spørringer og API-felter med karakterer skal vite hvilken ordning attesten hører til.
- Ny ordning har ikke oppvarmingskarakter; den er da tom (NULL), ikke en egen verdi.

**Kohortgrenser**
- "Lignende bygg" betyr samme bygningskategori og samme byggeårskohort.
- Kohortene følger byggtekniske forskrifter: før 1949, 1949–1969, 1970–1986, 1987–1996, 1997–2006, 2007–2016, 2017 og senere.
- Kohortgrensene står ett sted (SQL) og brukes likt i SQL og frontend; ikke lag nye grenser i nettleseren.
- Bygg uten gyldig byggeår (mangler, 0 eller før 1800) havner ikke i noen kohort og telles ikke som "lignende" på trinn 1.
- Sammenligning krever minst **10 enheter** i grunnlaget. Grunnlaget velges i to trinn:
  1. Samme bygningskategori og samme kohort.
  2. Har trinn 1 under 10 enheter (eller bygget mangler kohort): samme bygningskategori, uansett byggeår.
  Har heller ikke trinn 2 nok, skriv at det er for få lignende bygg. Si alltid i tekst og API hvilket grunnlag som er brukt.
- Tall som sammenligner byggets enheter én og én mot lignende bygg (f.eks. andel enheter bedre enn lignende) vises bare for bygg med minst 3 enheter.

## Språk
Brukergrensesnitt og tekst til brukere er **norsk (bokmål)**. Kode, variabler og commit-meldinger kan være engelsk eller norsk, men vær konsekvent i hver fil.
Energitallet heter **beregnet levert energi** (kWh/m² per år), som hos Enova. Ikke «energibehov», «energibruk» eller «forbruk».

## Arbeidsform
- Én agent = én gren (`git worktree`). Rediger bare mappen du eier (se `.claude/agents/`).
- Ikke commit direkte til `tiles` eller `main`. Lever gren; hovedsesjonen åpner pull request etter at eieren har godkjent.
- Test SQL mot lokal Postgres (bruker `Kodehode`, DB `Energimerking`, som i `docker-compose`) før levering. Rapporter radantall og kjøretid.
- Endrer du JSON-formatet fra et API: oppdater `docs/api-kontrakt.md` først og skriv det i rapporten din.
- Trenger du noe utenfor mappen din, eller er du usikker på en faglig regel: stopp og skriv det under **Usikkert** i rapporten. Agenter kan ikke snakke med hverandre underveis.
- Aldri legg hemmeligheter eller personopplysninger i repoet.

## Orkestrering (gjelder hovedsesjonen)
Hovedsesjonen (eieren + Claude) er orkestrator; subagenter kan ikke starte andre subagenter.
Eieren skal forstå og eie prosjektet, så arbeidet har tre godkjenningspunkter:

1. **Plan:** Del oppgaven etter lag (`sql-agent`, `frontend-agent`, `oversetter`). Vis planen med et tydelig "ferdig når" per agent, og vent på eierens godkjenning.
2. **API-kontrakt:** Skriv JSON-feltene i `docs/api-kontrakt.md` og få eierens godkjenning FØR SQL- og frontend-agent startes parallelt i hver sin worktree.
3. **Pull request:** Når agentene er ferdige, kjør `reviewer`. Vis eieren rapportene i `docs/logg/` og reviewerens funn og spørsmål. Rett "må fikses", og åpne pull request mot `tiles` først når eieren sier ja.

Ikke avbryt agenter underveis; gi dem heller presise oppgaver.
`oversetter` og `frontend-agent` eier samme mappe: kjør dem etter hverandre, ikke parallelt.

## Rapportering (alle agenter)
Når du er ferdig, lag én fil `docs/logg/ÅÅÅÅ-MM-DD-<agent>-<kort-tema>.md` (egen fil per agent, så grenene ikke får merge-konflikter):

- **Hva:** én til to setninger om hva du endret.
- **Hvorfor:** valgene du tok, og alternativer du forkastet.
- **Testet:** hva du kjørte, og resultatet (radantall, kjøretid, skjermbilde).
- **Usikkert:** det du ikke fikk testet, eller som eieren bør sjekke.
- **Lær dette:** ett begrep eller én teknikk eieren bør forstå (f.eks. "materialisert view", "DISTINCT ON"), forklart kort og knyttet til denne endringen.

Store beslutninger (datamodell, faglige tolkninger, valg som er dyre å endre) skrives også i `docs/beslutninger.md`.

## Kjente åpne punkter
- Live-databasen (`energimerke-db`) kjører fra `Documents\DockerEnergimerke`, ikke fra repoets `Backend/Docker`, og lytter fortsatt på `0.0.0.0`. Sett portene til `127.0.0.1` der (ta dump først, aldri `down -v`), eller flytt live til repoets compose som egen jobb.
- `WebApi.csproj` har `Microsoft.NET.Sdk.web` (liten w); må være `Web` for Linux.
- `energimerke.oppvarmingskarakter` er NOT NULL og blokkerer import av 2026-attester.
- «Enkel bygg» (vektor-tiles) viser én prikk per attest, ikke per enhet.
- **Etter «enheter i kartet» (reviewer 2026-11-17, eieren: ta når det trengs eller minn eieren på det):**
  - Svaret fra `api/enheter/punkter` er ca. 9,6 MB per bydel og ukomprimert. Eieren godtar det inntil videre; neste steg er `AddResponseCompression` (gzip), deretter ev. lavere tak eller færre felter (krever ny kontrakt).
  - `Frontend/src/dev/enheter-eksempel.js` (`kohortFor`) har egne kohortgrenser i nettleserkoden; bytt til faste kohort-tekster uten årsgrenser.
  - Ugyldig tall (`lat=abc`) i `api/enheter` gir engelsk ProblemDetails fra ASP.NET.
  - `docs/logg/2026-11-17-sql-agent-enheter-kart.md` har utdaterte stikkprøver (riktig: 21 151 enheter, 25 016 attester, 1 900 bygg i Gamle Oslo), og frontend-rapporten sier «ikke testet mot ekte API» (det er gjort).
  - `Sidebar.jsx` sier «Søker etter bygg nær stedet …», men søket gir enheter.
  - I Oppgraderingsprioritet viser kartet alltid gammel ordning og skjuler ordningsvalget; filterteksten nevner «statistikken», som ikke vises der.
