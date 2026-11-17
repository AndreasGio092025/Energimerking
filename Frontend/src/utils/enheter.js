import { buildUpgradeScores } from './filtering.js';

// Ordningene i API-et ("gammel" / "ny") og teksten brukeren ser.
export const ORDNINGER = [
  { value: 'gammel', label: 'Gammel ordning (2025)' },
  { value: 'ny', label: 'Ny ordning (fra 2026)' }
];

export function ordningLabel(ordning) {
  return ORDNINGER.find((item) => item.value === ordning)?.label || '';
}

// Gjør svaret fra GET api/enheter/punkter om til kartpunkter. Ett punkt = én enhet,
// så her velges ingen "siste attest": det er allerede gjort i databasen.
// Feltene fra kontrakten beholdes. Noen få eldre navn (energibruk_kwh_m2,
// certificateScheme) legges til, så kart, filtre og oppgraderingsprioritet virker som før.
export function normalizeEnhetPunkter(payload) {
  const rawFeatures = Array.isArray(payload?.features) ? payload.features : [];
  const features = rawFeatures
    .filter((feature) => {
      const coordinates = feature?.geometry?.coordinates;
      return Array.isArray(coordinates) && coordinates.length >= 2 && coordinates[0] != null && coordinates[1] != null;
    })
    .map((feature) => {
      const raw = feature.properties || {};
      const energi = raw.energi_kwh_m2 === null || raw.energi_kwh_m2 === undefined
        ? null
        : Number(raw.energi_kwh_m2);
      const properties = {
        id: String(raw.id),
        ordning: raw.ordning,
        bygningsnummer: raw.bygningsnummer,
        adresse: raw.adresse || '',
        bygningskategori: raw.bygningskategori ?? null,
        byggeaar: raw.byggeaar ?? null,
        kohort: raw.kohort ?? null,
        energikarakter: raw.energikarakter || '',
        oppvarmingskarakter: raw.oppvarmingskarakter ?? null,
        energi_kwh_m2: Number.isFinite(energi) ? energi : null,
        utstedelsesdato: raw.utstedelsesdato,
        antall_enheter_samme_punkt: raw.antall_enheter_samme_punkt ?? 1,
        energibruk_kwh_m2: Number.isFinite(energi) ? energi : null,
        certificateScheme: raw.ordning === 'ny' ? '2026' : 'legacy',
        certificateSchemeLabel: ordningLabel(raw.ordning),
        searchText: String(raw.adresse || '').toLowerCase()
      };
      return {
        type: 'Feature',
        id: properties.id,
        geometry: feature.geometry,
        properties: { ...properties, ...buildUpgradeScores(properties) }
      };
    });

  return {
    features,
    avkortet: payload?.avkortet === true,
    antall: Number.isFinite(Number(payload?.antall)) ? Number(payload.antall) : features.length
  };
}
