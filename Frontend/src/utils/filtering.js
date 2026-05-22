function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstValue(source, keys, fallback = '') {
  for (const key of keys) {
    if (source?.[key] !== null && source?.[key] !== undefined && source?.[key] !== '') {
      return source[key];
    }
  }

  return fallback;
}

function normalizeProperties(rawProperties = {}, coordinates = []) {
  const id = firstValue(
    rawProperties,
    ['id', 'denormId', 'DenormId', 'coordinateid', 'Coordinateid', 'CoordinateId', 'Bygningsnummer', 'bygningsnummer'],
    `${coordinates[0] || 0}-${coordinates[1] || 0}`
  );

  return {
    id,
    Bygningsnummer: firstValue(rawProperties, ['Bygningsnummer', 'bygningsnummer']),
    gard: firstValue(rawProperties, ['gard', 'gaard', 'Gardsnummer', 'gardsnummer', 'Gårdsnummer', 'gårdsnummer']),
    bruksnummer: firstValue(rawProperties, ['bruksnummer', 'Bruksnummer', 'Bruksnummmer', 'bruk', 'Bruk']),
    feste: firstValue(rawProperties, ['feste', 'Feste', 'festenummer', 'Festenummer']),
    andel: firstValue(rawProperties, ['andel', 'Andel', 'andelsnummer', 'Andelsnummer']),
    seksjon: firstValue(rawProperties, ['seksjon', 'Seksjon', 'seksjonsnummer', 'Seksjonsnummer']),
    adresse: firstValue(rawProperties, ['adresse', 'Adresse']),
    attestnummer: firstValue(rawProperties, ['attestnummer', 'Attestnummer']),
    organisasjonsNr: firstValue(rawProperties, ['organisasjonsNr', 'OrganisasjonsNr', 'organisasjonsnummer', 'Organisasjonsnummer']),
    utstedelsesdato: firstValue(rawProperties, ['utstedelsesdato', 'Utstedelsesdato']),
    materialvalg: firstValue(rawProperties, ['materialvalg', 'Materialvalg']),
    poststed: firstValue(rawProperties, ['poststed', 'Poststed']),
    postnummer: firstValue(rawProperties, ['postnummer', 'Postnummer']),
    kommunenavn: firstValue(rawProperties, ['kommunenavn', 'Kommunenavn', 'kommune', 'Kommune']),
    bruksenhetsNr: firstValue(rawProperties, [
      'bruksenhetsNr',
      'BruksenhetsNr',
      'brukenhetsnummer',
      'Brukenhetsnummer',
      'bruksenhetsnummer'
    ]),
    energikarakter: firstValue(rawProperties, ['energikarakter', 'Energikarakter']),
    oppvarmingskarakter: firstValue(rawProperties, ['oppvarmingskarakter', 'Oppvarmingskarakter']),
    beregnetLevertEnergiTotaltkWhm2: toNumber(
      firstValue(rawProperties, [
        'energibruk_kwh_m2',
        'EnergibrukKwhM2',
        'beregnetLevertEnergiTotaltkWhm2',
        'BeregnetLevertEnergiTotaltkWhm2'
      ], null),
      0
    ),
    energibruk_kwh_m2: toNumber(
      firstValue(rawProperties, [
        'energibruk_kwh_m2',
        'EnergibrukKwhM2',
        'beregnetLevertEnergiTotaltkWhm2',
        'BeregnetLevertEnergiTotaltkWhm2'
      ], null),
      0
    ),
    byggeaar: toNumber(firstValue(rawProperties, ['byggeaar', 'Byggeaar', 'byggeår', 'Byggeår'], null), null)
  };
}

export function normalizeGeoJson(payload) {
  const sourceFeatures = Array.isArray(payload?.features)
    ? payload.features
    : Array.isArray(payload)
      ? payload
          .map((item) => {
            const longitude = toNumber(firstValue(item, ['lon', 'Lon', 'longitude', 'Longitude'], null), null);
            const latitude = toNumber(firstValue(item, ['lat', 'Lat', 'latitude', 'Latitude'], null), null);

            return {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [longitude, latitude]
              },
              properties: item
            };
          })
      : [];

  return {
    type: 'FeatureCollection',
    features: sourceFeatures
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
