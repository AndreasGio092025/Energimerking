import { useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore.js';
import { buildFeatureCollection, buildNearbyCircleGeoJson, buildNearbyGeoJson } from '../utils/geo.js';
import {
  DEFAULT_CENTER,
  DEFAULT_RADIUS,
  DEFAULT_ZOOM,
  LAYER_IDS,
  MAP_STYLE_URL,
  SOURCE_IDS
} from '../utils/constants.js';
import '../styles/map-view.css';

function popupHtml(properties) {
  return `
    <div class="popup-card">
      <div class="popup-kicker">Building insight</div>
      <div class="popup-title">${properties.adresse || 'Unknown address'}</div>
      <div class="popup-subtitle">${properties.kommunenavn || 'Unknown municipality'}</div>
      <div class="popup-grid">
        <div class="popup-metric"><span>Energy grade</span><strong>${properties.energikarakter || 'N/A'}</strong></div>
        <div class="popup-metric"><span>Heat grade</span><strong>${properties.oppvarmingskarakter || 'N/A'}</strong></div>
        <div class="popup-metric"><span>kWh/m2</span><strong>${properties.energibruk_kwh_m2 ?? 'N/A'}</strong></div>
        <div class="popup-metric"><span>Build year</span><strong>${properties.byggeaar ?? 'N/A'}</strong></div>
      </div>
    </div>
  `;
}

function nearbyPopupHtml(properties) {
  return `
    <div class="popup-card popup-card-small">
      <div class="popup-kicker">Nearby result</div>
      <div class="popup-title">Coordinate #${properties.coordinateid}</div>
      <div class="popup-subtitle">Lat ${properties.latitude}, Lng ${properties.longitude}</div>
    </div>
  `;
}

function MapLegend() {
  const viewMode = useStore((state) => state.viewMode);

  return (
    <div className="map-legend">
      <div className="legend-kicker">Legend</div>
      {viewMode === 'heatmap' ? (
        <>
          <div className="legend-gradient" />
          <div className="legend-scale">
            <span>Low usage</span>
            <span>High usage</span>
          </div>
          <div className="legend-copy">Heatmap intensity is based on energibruk_kwh_m2.</div>
        </>
      ) : (
        <div className="legend-list">
          <div className="legend-item"><span className="legend-dot dot-cluster" />Clustered buildings</div>
          <div className="legend-item"><span className="legend-dot dot-building" />Individual building</div>
          <div className="legend-item"><span className="legend-dot dot-nearby" />Nearby results</div>
        </div>
      )}
    </div>
  );
}

function addMapLayers(map) {
  map.addSource(SOURCE_IDS.buildings, {
    type: 'geojson',
    data: buildFeatureCollection([]),
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 13
  });

  map.addLayer({
    id: LAYER_IDS.clusters,
    type: 'circle',
    source: SOURCE_IDS.buildings,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#0ea5e9', 25, '#14b8a6', 100, '#f97316'],
      'circle-radius': ['step', ['get', 'point_count'], 18, 25, 26, 100, 34],
      'circle-opacity': 0.88,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#f8fafc'
    }
  });

  map.addLayer({
    id: LAYER_IDS.clusterCount,
    type: 'symbol',
    source: SOURCE_IDS.buildings,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Open Sans Bold'],
      'text-size': 12
    },
    paint: {
      'text-color': '#ffffff'
    }
  });

  map.addLayer({
    id: LAYER_IDS.points,
    type: 'circle',
    source: SOURCE_IDS.buildings,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 5, 12, 9],
      'circle-color': '#0f9d8a',
      'circle-stroke-color': '#ecfeff',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.9
    }
  });

  map.addLayer({
    id: LAYER_IDS.heatmap,
    type: 'heatmap',
    source: SOURCE_IDS.buildings,
    maxzoom: 15,
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['coalesce', ['get', 'energibruk_kwh_m2'], 0], 0, 0, 50, 0.3, 150, 0.7, 400, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 9, 1.2, 13, 1.8],
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(15,23,42,0)', 0.15, '#1d4ed8', 0.35, '#14b8a6', 0.55, '#fde047', 0.75, '#fb923c', 1, '#dc2626'],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 10, 8, 26, 13, 42],
      'heatmap-opacity': 0.85
    }
  });

  map.addSource(SOURCE_IDS.selected, { type: 'geojson', data: buildFeatureCollection([]) });
  map.addLayer({
    id: LAYER_IDS.selectedHalo,
    type: 'circle',
    source: SOURCE_IDS.selected,
    paint: {
      'circle-radius': 18,
      'circle-color': 'rgba(250, 204, 21, 0.18)',
      'circle-stroke-color': '#facc15',
      'circle-stroke-width': 3
    }
  });
  map.addLayer({
    id: LAYER_IDS.selectedPoint,
    type: 'circle',
    source: SOURCE_IDS.selected,
    paint: {
      'circle-radius': 7,
      'circle-color': '#facc15',
      'circle-stroke-color': '#0f172a',
      'circle-stroke-width': 2
    }
  });

  map.addSource(SOURCE_IDS.nearby, { type: 'geojson', data: buildFeatureCollection([]) });
  map.addLayer({
    id: LAYER_IDS.nearby,
    type: 'circle',
    source: SOURCE_IDS.nearby,
    paint: {
      'circle-radius': 6,
      'circle-color': '#f97316',
      'circle-stroke-color': '#fff7ed',
      'circle-stroke-width': 2
    }
  });

  map.addSource(SOURCE_IDS.nearbyCircle, { type: 'geojson', data: buildFeatureCollection([]) });
  map.addLayer({
    id: LAYER_IDS.nearbyCircle,
    type: 'fill',
    source: SOURCE_IDS.nearbyCircle,
    paint: {
      'fill-color': '#f97316',
      'fill-opacity': 0.12,
      'fill-outline-color': '#fb923c'
    }
  });
}

function MapView({ features, allFeaturesCount, selectedFeature, nearbyState, onMapClick, isSearchingNearby }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const featuresRef = useRef(features);
  const mapClickRef = useRef(onMapClick);
  const hasFittedRef = useRef(false);
  const viewMode = useStore((state) => state.viewMode);
  const setSelectedFeature = useStore((state) => state.setSelectedFeature);
  const featureCollection = useMemo(() => buildFeatureCollection(features), [features]);
  const nearbyCollection = useMemo(() => buildNearbyGeoJson(nearbyState.results), [nearbyState.results]);
  const nearbyCircleCollection = useMemo(() => {
    if (!nearbyState.center) return buildFeatureCollection([]);
    return buildNearbyCircleGeoJson(
      nearbyState.center.longitude,
      nearbyState.center.latitude,
      nearbyState.radiusInMeters
    );
  }, [nearbyState.center, nearbyState.radiusInMeters]);
  const featureCollectionRef = useRef(featureCollection);
  const nearbyCollectionRef = useRef(nearbyCollection);
  const nearbyCircleCollectionRef = useRef(nearbyCircleCollection);
  const selectedFeatureRef = useRef(selectedFeature);
  const viewModeRef = useRef(viewMode);

  useEffect(() => {
    featuresRef.current = features;
  }, [features]);

  useEffect(() => {
    featureCollectionRef.current = featureCollection;
  }, [featureCollection]);

  useEffect(() => {
    nearbyCollectionRef.current = nearbyCollection;
  }, [nearbyCollection]);

  useEffect(() => {
    nearbyCircleCollectionRef.current = nearbyCircleCollection;
  }, [nearbyCircleCollection]);

  useEffect(() => {
    selectedFeatureRef.current = selectedFeature;
  }, [selectedFeature]);

  useEffect(() => {
    mapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return undefined;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    map.on('load', () => {
      addMapLayers(map);
      map.getSource(SOURCE_IDS.buildings).setData(featureCollectionRef.current);
      map.getSource(SOURCE_IDS.nearby).setData(nearbyCollectionRef.current);
      map.getSource(SOURCE_IDS.nearbyCircle).setData(nearbyCircleCollectionRef.current);

      const markerVisibility = viewModeRef.current === 'markers' ? 'visible' : 'none';
      const heatmapVisibility = viewModeRef.current === 'heatmap' ? 'visible' : 'none';
      map.setLayoutProperty(LAYER_IDS.clusters, 'visibility', markerVisibility);
      map.setLayoutProperty(LAYER_IDS.clusterCount, 'visibility', markerVisibility);
      map.setLayoutProperty(LAYER_IDS.points, 'visibility', markerVisibility);
      map.setLayoutProperty(LAYER_IDS.heatmap, 'visibility', heatmapVisibility);

      if (selectedFeatureRef.current) {
        map.getSource(SOURCE_IDS.selected).setData(
          buildFeatureCollection([selectedFeatureRef.current])
        );
      }

      map.on('click', LAYER_IDS.clusters, (event) => {
        const clusterFeature = map.queryRenderedFeatures(event.point, { layers: [LAYER_IDS.clusters] })[0];
        const clusterId = clusterFeature.properties.cluster_id;
        map.getSource(SOURCE_IDS.buildings).getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (!error) map.easeTo({ center: clusterFeature.geometry.coordinates, zoom });
        });
      });

      map.on('click', LAYER_IDS.points, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const selected = featuresRef.current.find((item) => item.id === feature.properties.id);
        setSelectedFeature(selected || null);
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 16 })
          .setLngLat(feature.geometry.coordinates.slice())
          .setHTML(popupHtml(feature.properties))
          .addTo(map);
      });

      map.on('click', LAYER_IDS.nearby, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setLngLat(feature.geometry.coordinates.slice())
          .setHTML(nearbyPopupHtml(feature.properties))
          .addTo(map);
      });

      map.on('click', (event) => {
        const hits = map.queryRenderedFeatures(event.point, { layers: [LAYER_IDS.clusters, LAYER_IDS.points, LAYER_IDS.nearby] });
        if (hits.length > 0) return;
        mapClickRef.current({
          latitude: Number(event.lngLat.lat.toFixed(6)),
          longitude: Number(event.lngLat.lng.toFixed(6)),
          radiusInMeters: DEFAULT_RADIUS
        });
      });

      [LAYER_IDS.clusters, LAYER_IDS.points, LAYER_IDS.nearby].forEach((layerId) => {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      });
    });

    mapRef.current = map;
    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [setSelectedFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource(SOURCE_IDS.buildings);
    if (source) source.setData(featureCollection);
    const markerVisibility = viewMode === 'markers' ? 'visible' : 'none';
    const heatmapVisibility = viewMode === 'heatmap' ? 'visible' : 'none';
    map.setLayoutProperty(LAYER_IDS.clusters, 'visibility', markerVisibility);
    map.setLayoutProperty(LAYER_IDS.clusterCount, 'visibility', markerVisibility);
    map.setLayoutProperty(LAYER_IDS.points, 'visibility', markerVisibility);
    map.setLayoutProperty(LAYER_IDS.heatmap, 'visibility', heatmapVisibility);
  }, [featureCollection, viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource(SOURCE_IDS.selected);
    if (!source) return;
    if (!selectedFeature) {
      source.setData(buildFeatureCollection([]));
      popupRef.current?.remove();
      return;
    }
    source.setData(buildFeatureCollection([selectedFeature]));
    map.flyTo({
      center: selectedFeature.geometry.coordinates,
      zoom: Math.max(map.getZoom(), 14),
      duration: 1200,
      essential: true
    });
  }, [selectedFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const nearbySource = map.getSource(SOURCE_IDS.nearby);
    const circleSource = map.getSource(SOURCE_IDS.nearbyCircle);
    if (nearbySource) nearbySource.setData(nearbyCollection);
    if (circleSource) circleSource.setData(nearbyCircleCollection);
  }, [nearbyCollection, nearbyCircleCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || hasFittedRef.current || allFeaturesCount === 0 || features.length === 0) return;
    const coordinates = features.map((feature) => feature.geometry.coordinates);
    const bounds = coordinates.reduce(
      (accumulator, coordinate) => accumulator.extend(coordinate),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
    );
    map.fitBounds(bounds, {
      padding: { top: 140, right: 80, bottom: 80, left: 420 },
      duration: 1400,
      maxZoom: 12
    });
    hasFittedRef.current = true;
  }, [allFeaturesCount, features]);

  return (
    <div className="map-shell">
      <div ref={mapContainerRef} className="map-canvas" />
      <div className="map-floating">
        <MapLegend />
        {isSearchingNearby && (
          <motion.div className="map-pill" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            Finding nearby buildings within {DEFAULT_RADIUS.toLocaleString()} m...
          </motion.div>
        )}
        {nearbyState.results.length > 0 && (
          <div className="map-pill">
            <strong>{nearbyState.results.length}</strong> nearby coordinates returned by the API
          </div>
        )}
      </div>
    </div>
  );
}

export default MapView;
