export function buildFeatureCollection(features) {
  return {
    type: 'FeatureCollection',
    features
  };
}

export function groupNearbyResultsByCoordinate(results) {
  const grouped = new Map();
  
  results.forEach((item) => {
    const key = `${item.longitude.toFixed(5)}-${item.latitude.toFixed(5)}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  });
  
  return grouped;
}

export function buildNearbyGeoJson(results) {
  const grouped = groupNearbyResultsByCoordinate(results);
  const features = Array.from(grouped.values())
    .filter((group) => {
      const item = group[0];
      return (
        item &&
        Number.isFinite(Number(item.longitude ?? item.Longitude)) &&
        Number.isFinite(Number(item.latitude ?? item.Latitude))
      );
    })
    .map((group) => {
      const item = group[0];
      const longitude = Number(item.longitude ?? item.Longitude);
      const latitude = Number(item.latitude ?? item.Latitude);

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        properties: {
          coordinateid: item.coordinateid ?? item.Coordinateid ?? item.CoordinateId,
          latitude: latitude.toFixed(5),
          longitude: longitude.toFixed(5),
          unitCount: group.length,
          units: JSON.stringify(
            group.map((u) => ({
              id: u.coordinateid ?? u.Coordinateid ?? u.CoordinateId,
              bruksenhetsNr: u.bruksenhetsNr || u.brukenhetsnummer || '',
              energikarakter: u.energikarakter || u.Energikarakter || '',
              distanceInMeters: u.distanceInMeters
            }))
          )
        }
      };
    });

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
