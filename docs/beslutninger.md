# Beslutninger

Kort logg over valg som er viktige eller dyre å endre. Nyeste øverst.

## 2026-11-16: Reserve-trinn for lignende bygg, og spredning i bygget
**Beslutning:**
- Har kategori + kohort under 10 enheter, sammenlignes med hele kategorien uansett byggeår. API-et sier hvilket grunnlag som er brukt (`grunnlag`).
- Bygg-oversikten viser hvor stor andel av byggets enheter som er bedre enn medianen for lignende bygg, men bare for bygg med minst 3 enheter.

**Hvorfor:** Målt 2026-11-15 (gammel ordning): boligblokker og småhus har nok enheter i 7 av 8 kohorter, men skoler, kulturbygg, idrettsbygg og sykehus har ingen kohort med 10 enheter. Uten reserve ville ikke-boliger nesten aldri fått sammenligning. Byggets median alene skjuler spredning (halve bygget på A og halve på G ser middels ut). Grensen på 3 enheter hindrer at tallet i praksis beskriver én bolig.

## 2026-11-15: Adresse er med i enhetsnøkkelen
**Beslutning:** En enhet er bygningsnummer + bruksenhetsnummer + adresse.
**Hvorfor:** `sql-agent` fant at bruksenhetsnummer (f.eks. H0101) gjentas på hver inngang i samme bygg. Uten adresse ble ulike leiligheter slått sammen: 67 351 enheter i gammel ordning og 11 287 i ny. Med adresse blir det 108 107 og 13 429.

## 2026-11-15: Faglige regler avgjort
**Beslutning:**
- Enhet i statistikk er bruksenheten (bygningsnummer + bruksenhetsnummer), med siste attest per enhet.
- Ordning går på utstedelsesdato: før 2026-01-01 er gammel ordning, fra og med er ny.
- Kohorter etter byggtekniske forskrifter: før 1949, 1949–69, 1970–86, 1987–96, 1997–2006, 2007–16, 2017+.
- Minst 10 enheter i en kohort før sammenligning vises.

**Hvorfor:** Borettslag og sameier har én attest per leilighet, så bygning som enhet ville skjult forskjeller. Dataene viser at 2025-attester har oppvarmingskarakter og 2026-attester (fra 7. jan.) ikke har det, så datoskillet stemmer med dataene og krever ikke et eget felt. Forskriftene markerer når kravene til bygg endret seg. 10 er nok til å unngå de minste gruppene uten å skjule de fleste områder.

## 2026-11-13: Hovedsesjonen er orkestrator
**Beslutning:** Eieren og hovedsesjonen planlegger og fordeler arbeid; det finnes ingen egen orkestrator-agent.
**Hvorfor:** Subagenter kan ikke starte andre subagenter, og eieren vil ha innsyn og eierskap.
Arbeidet har tre godkjenningspunkter: plan, API-kontrakt og pull request.
