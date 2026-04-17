function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProperties(rawProperties = {}, coordinates = []) {
  return {
    id:
      rawProperties.Bygningsnummer ||
      rawProperties.Bygningsnummer ||
      rawProperties.CoordinateId ||
      `${coordinates[0] || 0}-${coordinates[1] || 0}`,
    Bygningsnummer: rawProperties.Bygningsnummer || rawProperties.Bygningsnummer || '',
    bruksnummer: rawProperties.bruksnummer || rawProperties.Bruksnummer || rawProperties.Bruksnummmer || '',
    adresse: rawProperties.adresse || rawProperties.Adresse || '',
    attestnummer: rawProperties.attestnummer || rawProperties.Attestnummer || '',
    poststed: rawProperties.poststed || rawProperties.Poststed || '',
    postnummer: rawProperties.postnummer || rawProperties.Postnummer || '',
    kommunenavn: rawProperties.kommunenavn || rawProperties.Kommunenavn || '',
    energikarakter: rawProperties.energikarakter || rawProperties.Energikarakter || '',
    oppvarmingskarakter:
      rawProperties.oppvarmingskarakter || rawProperties.Oppvarmingskarakter || '',
    energibruk_kwh_m2: toNumber(
      rawProperties.energibruk_kwh_m2 ?? rawProperties.EnergibrukKwhM2,
      0
    ),
    byggeaar: toNumber(rawProperties.byggeaar ?? rawProperties.Byggeaar, null)
  };
}

export function normalizeGeoJson(payload) {
  const features = Array.isArray(payload?.features) ? payload.features : [];

  return {
    type: 'FeatureCollection',
    features: features
      .filter((feature) => {
        const coordinates = feature?.geometry?.coordinates;
        return (
          Array.isArray(coordinates) &&
          coordinates.length >= 2 &&
          coordinates[0] !== null &&
          coordinates[1] !== null
        );
      })
      .map((feature, index) => {
        const coordinates = feature.geometry.coordinates;
        const properties = normalizeProperties(feature.properties, coordinates);
        const searchText = [
          properties.adresse,
          properties.poststed,
          properties.kommunenavn
        ]
          .join(' ')
          .toLowerCase();

        return {
          ...feature,
          id: properties.id || `feature-${index}`,
          properties: {
            ...properties,
            id: properties.id || `feature-${index}`,
            searchText
          }
        };
      })
  };
}

export function buildInitialFilterBounds(features) {
  if (features.length === 0) {
    return {
      byggeaar: [1900, 2026],
      energibruk_kwh_m2: [0, 500]
    };
  }

  const years = features
    .map((feature) => feature.properties.byggeaar)
    .filter((value) => Number.isFinite(value));
  const energyValues = features
    .map((feature) => feature.properties.energibruk_kwh_m2)
    .filter((value) => Number.isFinite(value));

  return {
    byggeaar: [
      years.length ? Math.min(...years) : 1900,
      years.length ? Math.max(...years) : 2026
    ],
    energibruk_kwh_m2: [
      energyValues.length ? Math.floor(Math.min(...energyValues)) : 0,
      energyValues.length ? Math.ceil(Math.max(...energyValues)) : 500
    ]
  };
}

export function filterFeatures(features, filters) {
  const [yearMin, yearMax] = filters.byggeaar;
  const [energyMin, energyMax] = filters.energibruk_kwh_m2;

  return features.filter((feature) => {
    const props = feature.properties;
    const year = props.byggeaar;
    const energy = props.energibruk_kwh_m2;

    const matchesYear = year === null || (year >= yearMin && year <= yearMax);
    const matchesEnergy = energy >= energyMin && energy <= energyMax;
    const matchesEnergyGrade =
      filters.energikarakter === 'all' || props.energikarakter === filters.energikarakter;
    const matchesHeatingGrade =
      filters.oppvarmingskarakter === 'all' ||
      props.oppvarmingskarakter === filters.oppvarmingskarakter;

    return matchesYear && matchesEnergy && matchesEnergyGrade && matchesHeatingGrade;
  });
}

export function getSearchSuggestions(features, query) {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return [];
  }

  return features
    .filter((feature) => feature.properties.searchText.includes(trimmedQuery))
    .sort((left, right) => {
      const leftAddress = left.properties.adresse || '';
      const rightAddress = right.properties.adresse || '';
      const leftStarts = leftAddress.toLowerCase().startsWith(trimmedQuery) ? 0 : 1;
      const rightStarts = rightAddress.toLowerCase().startsWith(trimmedQuery) ? 0 : 1;

      if (leftStarts !== rightStarts) {
        return leftStarts - rightStarts;
      }

      return leftAddress.localeCompare(rightAddress);
    })
    .slice(0, 10);
}
