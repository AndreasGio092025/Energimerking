// Gjør filtrene i sidepanelet om til et MapLibre-filter for tile-lagene i «Enkel bygg».
// Her regnes det ikke ut noe: filteret sammenligner bare feltene som databasen allerede har levert.
// Lagene har ulike feltnavn (kontrakten «Vektor-tiles for Enkel bygg»):
//   enheter: energikarakter, energi_kwh_m2, oppvarmingskarakter, byggeaar
//   bygg:    median_karakter, median_kwh_m2, byggeaar (ingen oppvarmingskarakter)
// Et filter som står på standardverdi (hele området) tas ikke med, så punkter uten
// byggeår eller energitall ikke forsvinner uten at brukeren har valgt noe.

const FELT = {
  enheter: { karakter: 'energikarakter', energi: 'energi_kwh_m2' },
  bygg: { karakter: 'median_karakter', energi: 'median_kwh_m2' }
};

// En glidebryter som står helt ute i kanten gir en åpen grense (ingen filtrering på den siden).
// Glidebryterens ytterpunkter kommer fra bydelsdataene, men tilene dekker hele Oslo.
function innenforEllerUkjent(felt, [min, max], [boundMin, boundMax]) {
  const grenser = [];
  if (Number.isFinite(min) && min > boundMin) grenser.push(['>=', ['get', felt], min]);
  if (Number.isFinite(max) && max < boundMax) grenser.push(['<=', ['get', felt], max]);
  if (grenser.length === 0) return null;
  return ['any', ['!', ['has', felt]], ['all', ...grenser]];
}

export function buildTileFilter(visning, ordning, filters, filterBounds) {
  const felt = FELT[visning] || FELT.enheter;
  const vilkaar = [];

  const byggeaar = innenforEllerUkjent('byggeaar', filters.byggeaar, filterBounds.byggeaar);
  if (byggeaar) vilkaar.push(byggeaar);
  const energi = innenforEllerUkjent(felt.energi, filters.energibruk_kwh_m2, filterBounds.energibruk_kwh_m2);
  if (energi) vilkaar.push(energi);

  const karakterer = Array.isArray(filters.energikarakter)
    ? filters.energikarakter
    : filters.energikarakter && filters.energikarakter !== 'all'
      ? [filters.energikarakter]
      : [];
  if (karakterer.length > 0) {
    vilkaar.push(['in', ['get', felt.karakter], ['literal', karakterer]]);
  }

  // Oppvarmingskarakter finnes bare per enhet i gammel ordning (null i ny ordning og per bygg).
  if (visning === 'enheter' && ordning === 'gammel' && filters.oppvarmingskarakter && filters.oppvarmingskarakter !== 'all') {
    vilkaar.push(['==', ['get', 'oppvarmingskarakter'], filters.oppvarmingskarakter]);
  }

  return vilkaar.length === 0 ? null : ['all', ...vilkaar];
}
