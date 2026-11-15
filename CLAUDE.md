# Energimerking

Webapplikasjon for å utforske energimerker for bygg i Oslo: React/Vite-frontend (`Frontend/`),
.NET Web API (`Backend/WebApi/`, `Backend/Core/`) og PostgreSQL/PostGIS (`Backend/Docker/`).
Se `README.md` for oppsett og kjøring.

## Mapper og eiere
- `Backend/Docker/db-init/`: SQL (`sql-agent`)
- `Frontend/src/`: frontend (`frontend-agent`); tekststrenger også `oversetter`
- `docs/`: API-kontrakt, beslutninger og agentlogg

## Faglige regler
Utkast 2026-11-14. Punkter merket **ÅPENT** må eieren avgjøre før reglene er bindende.

**Enheter vs attester**
- En attest (`Attestnummer`) er én utstedelse fra Enova. En enhet (bygning eller bruksenhet) kan ha flere attester over tid.
- Statistikk teller *enheter*, ikke attester: bruk siste attest per enhet (høyeste `Utstedelsesdato`), slik `mv_leilighet_siste_energimerke` gjør med `rn = 1`.
- Skriv alltid i tekst og API om et tall er "antall enheter" eller "antall attester".
- **ÅPENT:** Er enheten bruksenhet (leilighet) eller bygning når vi lager bydels- og byggstatistikk?

**Ordning blandet**
- Energimerkeordningen endres i 2026. Karakterer fra gammel og ny ordning er ikke samme skala.
- Bland aldri gammel og ny ordning i samme gjennomsnitt, fordeling eller sammenligning. Vis dem hver for seg, eller bruk overgangsnøkkelen når den finnes.
- Alle spørringer og API-felter med karakterer skal vite hvilken ordning attesten hører til.
- **ÅPENT:** Hva skiller ordningene i dataene (utstedelsesdato fra og med en gitt dag, eller et eget felt i Enova-filen)?

**Kohortgrenser**
- "Lignende bygg" betyr samme bygningskategori og samme byggeårskohort.
- Kohortgrensene står ett sted (SQL) og brukes likt i SQL og frontend; ikke lag nye grenser i nettleseren.
- Bygg uten `Byggeaar` havner ikke i noen kohort og telles ikke som "lignende".
- **ÅPENT:** Hvilke grenser? Forslag: etter byggtekniske forskrifter (før 1949, 1949–1969, 1970–1986, 1987–1996, 1997–2006, 2007–2016, 2017 og senere).
- **ÅPENT:** Minste antall bygg i en kohort før vi viser sammenligning (forslag: 10).

## Språk
Brukergrensesnitt og tekst til brukere er **norsk (bokmål)**. Kode, variabler og commit-meldinger kan være engelsk eller norsk, men vær konsekvent i hver fil.

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
- `WebApi.csproj` har `Microsoft.NET.Sdk.web` (liten w); må være `Web` for Linux.
- `energimerke.oppvarmingskarakter` er NOT NULL og blokkerer import av 2026-attester.
