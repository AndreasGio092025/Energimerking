import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000
});

export async function fetchBuildingsGeoJson() {
  const response = await api.get('/bygg/geojson');
  return response.data;
}

export async function fetchNearbyBuildings(latitude, longitude, radiusInMeters) {
  const response = await api.get('/bygg/nearby', {
    params: {
      latitude,
      longitude,
      radiusInMeters
    }
  });

  return response.data;
}

export default api;
