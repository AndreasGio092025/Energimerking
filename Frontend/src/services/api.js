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

async function getJson(path, params) {
  const response = await fetch(buildUrl(path, params), {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
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

export async function fetchBuildingsGeoJson() {
  return getJson('/bygg/GetNearbyDeNormGeoJson', {
    latitude: 59.917330,
    longitude:  10.844128,
    radiusInMeters: 3000,
    amount: 20000
  });
}
