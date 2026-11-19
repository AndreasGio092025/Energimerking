# 2026-11-19 frontend-agent: rettinger etter reviewer

**Hva:** Filtrene i «Enkel bygg» skjuler ikke lenger punkter når glidebryteren står i kanten, teksten nederst i kartet bryter linjen, og oppvarmingskarakteren `LightGreen` vises ikke lenger som «Mangler».

**Hvorfor:**
- Filtergrenser: Glidebryterens ytterpunkter kommer fra bydelsdataene, men tilene dekker hele Oslo. `buildTileFilter` (`utils/tileFilter.js`) tar nå med en grense bare når bryteren er flyttet inn fra kanten, og hver side vurderes for seg. Står begge i kanten, blir det ikke noe filter. Byggeår og beregnet levert energi behandles likt. Alternativet, å hente faste grenser fra API-et, ble forkastet fordi kontrakten ikke har slike felter.
- Ordning: `setEnkelOrdning` (`store/useStore.js`) nullstiller filtrene når brukeren bytter ordning i «Enkel bygg», så gammel og ny ordning ikke blandes (karakter- og oppvarmingsvalg fra den ene følger ikke med til den andre). Kartlaget og tile-adressen fulgte `enkelOrdning` fra før.
- Tekst i kartet: `.map-pill` har fått maksbredde (320 px eller hele bredden) og bryter linjen. `.map-floating` har fått `max-width: calc(100% - 20px)`.
- LightGreen: lagt til i `VALID_HEATING_GRADES` i `utils/upgradeInsights.js`. Karakteren gjøres allerede om til store bokstaver før sammenligning, så `LightGreen` og `Lightgreen` håndteres likt. Kohortinndelingen er ikke endret.

**Testet:**
- `npm run build` i `Frontend`: grønn (kun vanlig advarsel om store filer). `Frontend/dist` er tilbakestilt etter bygget.
- Nettleser med `?eksempel=enheter` på 779 px og 375 px: teksten «Viser ett punkt per enhet, gammel ordning (før 2026)» bryter linjen og ligger innenfor kartet. Ved 375 px dekker sidepanelet kartet til det lukkes; da er teksten synlig og hel.
- Filterfunksjonen kjørt direkte i nettleseren: nedre grense flyttet til 1950 og øvre grense i kanten gir bare `>= 1950` (uten øvre grense); begge i kanten gir ingen filter.
- Ikke kjørt: ekte API og ekte tiles (bare eksempeldata), og ingen automatisk test av `upgradeInsights`.

**Usikkert:**
- Skjermbilde med Playwright ble ikke tatt; jeg brukte nettleserruten i appen. Ta det på nytt hvis det er et krav.
- Glidebryteren kan fortsatt ikke stilles inn utenfor bydelens egen byggeårsspenn (f.eks. 1923–2022). Ytterpunktene gir åpen grense, så ingen punkter mistes, men et valg som «bare eldre enn 1900» går ikke. Faste grenser for hele Oslo i «Enkel bygg» krever enten et felt i API-kontrakten eller en avklaring med eieren.
- Ved 375 px dekker sidepanelet (88 % av bredden) kartet, så teksten ligger under panelet til det lukkes. Det er panelets oppførsel, ikke endret her.
- Å nullstille filtre ved bytte av ordning er mitt valg; si fra hvis det er uønsket.

**Lær dette:** *Åpen grense.* Et filter med både nedre og øvre grense kan egentlig være to separate vilkår. Står bryteren i ytterkanten, betyr det «ingen grense på denne siden», ikke «akkurat denne verdien». Da må ikke vilkåret tas med, ellers kutter det bort alt utenfor datautvalget glidebryteren ble laget fra.
