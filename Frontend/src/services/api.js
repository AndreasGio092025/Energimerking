const API_BASE_URL = '/api';

function buildUrl(path, params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return `${API_BASE_URL}${path}${query ? `?${query}` : ''}`;
}

async function getJson(path, params, options = {}) {
  const response = await fetch(buildUrl(path, params), {
    signal: options.signal,
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Forespørselen feilet med status ${response.status}`);
  }

  const payload = await response.json();

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }

  return payload;
}

// Enheter i kartet (docs/api-kontrakt.md, «Enheter i kartet»).
// Med ?eksempel=enheter i adressen brukes oppdiktede testdata i stedet for API-et.
// Det er aldri en stille reserve: uten parameteren gir en API-feil en feilmelding.
function eksempelNavn() {
  const navn = new URLSearchParams(window.location.search).get('eksempel') || '';
  return navn.startsWith('enheter') ? navn : null;
}

export function brukerEksempelData() {
  return eksempelNavn() !== null;
}

// ordning: 'gammel' eller 'ny' (kartet bruker aldri 'alle').
export async function fetchEnhetPunkter({ latitude, longitude, radiusInMeters, ordning }, options = {}) {
  const eksempel = eksempelNavn();
  if (eksempel) {
    const { eksempelPunkter } = await import('../dev/enheter-eksempel.js');
    return eksempelPunkter({ lat: latitude, lon: longitude, radius: radiusInMeters, ordning, avkortet: eksempel === 'enheter-avkortet' });
  }
  return getJson('/enheter/punkter', {
    lat: latitude,
    lon: longitude,
    radius: Math.round(radiusInMeters),
    ordning
  }, options);
}

export async function fetchEnhetStatistikk({ latitude, longitude, radiusInMeters }, options = {}) {
  if (eksempelNavn()) {
    const { eksempelStatistikk } = await import('../dev/enheter-eksempel.js');
    return eksempelStatistikk({ lat: latitude, lon: longitude, radius: radiusInMeters });
  }
  return getJson('/enheter/statistikk', {
    lat: latitude,
    lon: longitude,
    radius: Math.round(radiusInMeters)
  }, options);
}

export async function fetchBuildingsBoundsGeoJson(params = {}, options = {}) {
  return getJson('/bygg/GetBoundsDeNormGeoJson', params, options);
}

export async function fetchTilePointDetails(id, options = {}) {
  return getJson('/bygg/GetTilePointDetails', { id }, options);
}

export async function fetchBydelStats(bydelId) {
  return getJson(`/bydel-stats/${encodeURIComponent(bydelId)}`);
}

// Bygg-oversikt. Kaster Error med `status` (f.eks. 404) hvis bygget ikke finnes.
async function getByggJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal: options.signal,
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) {
    const error = new Error(`Forespørselen feilet med status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function fetchByggOversikt(bygningsnummer, options = {}) {
  return getByggJson(`/bygg-oversikt/${encodeURIComponent(bygningsnummer)}`, options);
}

export function fetchByggFraAttest(attestnummer, options = {}) {
  return getByggJson(`/bygg-oversikt/fra-attest/${encodeURIComponent(attestnummer)}`, options);
}
