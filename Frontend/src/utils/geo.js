export function buildFeatureCollection(features) {
  return {
    type: 'FeatureCollection',
    features
  };
}

export function buildNearbyGeoJson(results) {
  const features = results
    .filter(
      (item) =>
        item &&
        Number.isFinite(Number(item.longitude)) &&
        Number.isFinite(Number(item.latitude))
    )
    .map((item) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [Number(item.longitude), Number(item.latitude)]
      },
      properties: {
        coordinateid: item.coordinateid,
        latitude: Number(item.latitude).toFixed(5),
        longitude: Number(item.longitude).toFixed(5)
      }
    }));

  return buildFeatureCollection(features);
}

export function buildNearbyCircleGeoJson(longitude, latitude, radiusInMeters, points = 64) {
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(radiusInMeters)
  ) {
    return buildFeatureCollection([]);
  }

  const coordinates = [];
  const earthRadius = 6371008.8;
  const latRadians = (latitude * Math.PI) / 180;

  for (let index = 0; index <= points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const dx = radiusInMeters * Math.cos(angle);
    const dy = radiusInMeters * Math.sin(angle);
    const nextLatitude = latitude + (dy / earthRadius) * (180 / Math.PI);
    const nextLongitude =
      longitude + ((dx / earthRadius) * (180 / Math.PI)) / Math.cos(latRadians);

    coordinates.push([nextLongitude, nextLatitude]);
  }

  return buildFeatureCollection([
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      },
      properties: {
        radiusInMeters
      }
    }
  ]);
}
