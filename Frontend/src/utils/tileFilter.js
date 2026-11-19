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

function innenforEllerUkjent(felt, [min, max]) {
  return [
    'any',
    ['!', ['has', felt]],
    ['all', ['>=', ['get', felt], min], ['<=', ['get', felt], max]]
  ];
}

function sammeOmraade(valgt, grenser) {
  return Array.isArray(valgt) && Array.isArray(grenser) && valgt[0] === grenser[0] && valgt[1] === grenser[1];
}

export function buildTileFilter(visning, ordning, filters, filterBounds) {
  const felt = FELT[visning] || FELT.enheter;
  const vilkaar = [];

  if (!sammeOmraade(filters.byggeaar, filterBounds.byggeaar)) {
    vilkaar.push(innenforEllerUkjent('byggeaar', filters.byggeaar));
  }
  if (!sammeOmraade(filters.energibruk_kwh_m2, filterBounds.energibruk_kwh_m2)) {
    vilkaar.push(innenforEllerUkjent(felt.energi, filters.energibruk_kwh_m2));
  }

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
