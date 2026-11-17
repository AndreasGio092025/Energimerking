import { useEffect, useMemo, useRef, useState } from 'react';
import MapView from './components/MapView.jsx';
import Sidebar from './components/Sidebar.jsx';
import SearchBar from './components/SearchBar.jsx';
import { brukerEksempelData, fetchEnhetPunkter } from './services/api.js';
import { useStore } from './store/useStore.js';
import { buildInitialFilterBounds, filterFeatures, getSearchSuggestions } from './utils/filtering.js';
import { normalizeEnhetPunkter } from './utils/enheter.js';
import { findBydel } from './utils/osloBydeler.js';
import './styles/app.css';

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function distanceInMeters(from, to) {
  const earthRadius = 6371008.8;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function extractErrorMessage(error, fallbackMessage) {
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function mergeFeaturesById(existingFeatures, incomingFeatures) {
  const merged = new Map();

  existingFeatures.forEach((feature) => {
    merged.set(String(feature.id || feature.properties?.id), feature);
  });

  incomingFeatures.forEach((feature) => {
    merged.set(String(feature.id || feature.properties?.id), feature);
  });

  return Array.from(merged.values());
}

function App() {
  const theme = useStore((state) => state.theme);
  const searchQuery = useStore((state) => state.searchQuery);
  const selectedFeature = useStore((state) => state.selectedFeature);
  const selectedBydelId = useStore((state) => state.selectedBydelId);
  const nearby = useStore((state) => state.nearby);
  const ordning = useStore((state) => state.ordning);
  const viewMode = useStore((state) => state.viewMode);
  const setPunktInfo = useStore((state) => state.setPunktInfo);
  const filters = useStore((state) => state.filters);
  const allFeatures = useStore((state) => state.allFeatures);
  const isLoading = useStore((state) => state.isLoading);
  const error = useStore((state) => state.error);
  const initializeFilters = useStore((state) => state.initializeFilters);
  const setLoading = useStore((state) => state.setLoading);
  const setError = useStore((state) => state.setError);
  const setAllFeatures = useStore((state) => state.setAllFeatures);
  const setSelectedFeature = useStore((state) => state.setSelectedFeature);
  const setNearby = useStore((state) => state.setNearby);
  const setSearchQuery = useStore((state) => state.setSearchQuery);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [searchSelection, setSearchSelection] = useState(null);
  const bydelCacheRef = useRef(new Map());
  // Oppgraderingsprioritet bygger på gammel ordning; ellers følger kartet valget i panelet.
  const aktivOrdning = viewMode === 'upgrade' ? 'gammel' : ordning;

  useEffect(() => {
    document.body.classList.toggle('theme-dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const bydel = findBydel(selectedBydelId);
    const cacheKey = `${selectedBydelId}:${aktivOrdning}`;
    const cached = bydelCacheRef.current.get(cacheKey);

    const applyBydelData = ({ features, avkortet, antall }) => {
      setAllFeatures(features);
      setPunktInfo({ avkortet, antall });
      initializeFilters(buildInitialFilterBounds(features));
      setNearby({
        center: {
          latitude: bydel.latitude,
          longitude: bydel.longitude
        },
        radiusInMeters: bydel.radiusInMeters,
        results: []
      });
    };

    if (cached) {
      setError('');
      setLoading(false);
      applyBydelData(cached);
      return () => {
        active = false;
        controller.abort();
      };
    }

    async function loadData() {
      try {
        setLoading(true);
        setError('');
        const payload = await fetchEnhetPunkter({
          latitude: bydel.latitude,
          longitude: bydel.longitude,
          radiusInMeters: bydel.radiusInMeters,
          ordning: aktivOrdning
        }, {
          signal: controller.signal
        });
        if (!active) return;
        const normalized = normalizeEnhetPunkter(payload);
        bydelCacheRef.current.set(cacheKey, normalized);
        applyBydelData(normalized);
      } catch (loadError) {
        if (!active) return;
        if (loadError?.name === 'AbortError') return;
        setAllFeatures([]);
        setPunktInfo({ avkortet: false, antall: 0 });
        initializeFilters(buildInitialFilterBounds([]));
        setError(extractErrorMessage(loadError, 'Kunne ikke hente enhetene fra serveren.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
      controller.abort();
    };
  }, [aktivOrdning, initializeFilters, selectedBydelId, setAllFeatures, setError, setLoading, setNearby, setPunktInfo]);

  const filteredFeatures = useMemo(
    () => filterFeatures(allFeatures, filters),
    [allFeatures, filters]
  );
  const selectedBydel = useMemo(() => findBydel(selectedBydelId), [selectedBydelId]);
  const suggestions = useMemo(
    () => getSearchSuggestions(allFeatures, searchQuery),
    [allFeatures, searchQuery]
  );
  const selectedFeatureFromList = useMemo(() => {
    if (!selectedFeature?.id) return null;
    return (
      filteredFeatures.find((feature) => feature.id === selectedFeature.id) ||
      allFeatures.find((feature) => feature.id === selectedFeature.id) ||
      null
    );
  }, [allFeatures, filteredFeatures, selectedFeature]);

  const handleSuggestionSelect = (feature) => {
    setSelectedFeature(feature);
    setSearchQuery(feature.properties.adresse || feature.properties.poststed || '');
    setSearchSelection({
      featureId: feature.id,
      selectedAt: Date.now()
    });
  };

  const handleMapClick = async ({ latitude, longitude, radiusInMeters }) => {
    setIsSearchingNearby(true);
    setError('');
    const center = { latitude, longitude };

    setNearby({
      center,
      radiusInMeters,
      results: []
    });

    try {
      const payload = await fetchEnhetPunkter({
        latitude,
        longitude,
        radiusInMeters,
        ordning: aktivOrdning
      });
      const normalized = normalizeEnhetPunkter(payload);
      const results = normalized.features
        .map((feature) => {
          const [featureLongitude, featureLatitude] = feature.geometry.coordinates;
          const featurePoint = {
            latitude: Number(featureLatitude),
            longitude: Number(featureLongitude)
          };

          return {
            coordinateid: feature.properties.id,
            latitude: featurePoint.latitude,
            longitude: featurePoint.longitude,
            adresse: feature.properties.adresse,
            energikarakter: feature.properties.energikarakter || '',
            distanceInMeters: distanceInMeters(center, featurePoint)
          };
        })
        .filter((item) => item.distanceInMeters <= radiusInMeters)
        .sort((left, right) => left.distanceInMeters - right.distanceInMeters)
        .slice(0, 200);

      setAllFeatures(mergeFeaturesById(allFeatures, normalized.features));
      setNearby({
        center,
        radiusInMeters,
        results
      });
    } catch (nearbyError) {
      setError(extractErrorMessage(nearbyError, 'Kunne ikke søke etter enheter i nærheten.'));
    } finally {
      setIsSearchingNearby(false);
    }
  };

  const isEmpty = !isLoading && !error && filteredFeatures.length === 0;
  const emptyTitle = allFeatures.length === 0
    ? 'Ingen enheter funnet i området'
    : 'Ingen enheter passer med filtrene';
  const emptyCopy = allFeatures.length === 0
    ? 'Det finnes ingen enheter med kartpunkt i dette området for valgt ordning. Prøv en annen bydel eller den andre ordningen.'
    : 'Juster områdene eller karakterfiltrene for å få treff igjen.';

  return (
    <div className={`app-shell ${theme === 'dark' ? 'theme-dark' : ''}`}>
      <div className="app-background" />
      <div className="app-layout">
        <Sidebar
          isSearchingNearby={isSearchingNearby}
        />
        <main className="app-main">
          {brukerEksempelData() && (
            <div className="eksempel-banner" role="note">Testdata med oppdiktede adresser (?eksempel=enheter). Ikke ekte tall.</div>
          )}
          <div className="top-overlay">
            <SearchBar
              suggestions={suggestions}
              hasData={allFeatures.length > 0}
              onSuggestionSelect={handleSuggestionSelect}
            />
          </div>
          <MapView
            features={filteredFeatures}
            allFeaturesCount={allFeatures.length}
            selectedFeature={selectedFeatureFromList}
            searchSelection={searchSelection}
            nearbyState={nearby}
            selectedBydel={selectedBydel}
            onMapClick={handleMapClick}
            isSearchingNearby={isSearchingNearby}
          />
          {isLoading && (
              <div className="status-overlay">
                <div className="status-card" role="status" aria-live="polite">
                  <div className="spinner" aria-hidden="true" />
                  <div>
                    <div className="status-title">Laster byggdata</div>
                    <div className="status-copy">Gjør klar kart, lag og filtre.</div>
                  </div>
                </div>
              </div>
            )}
          {error && !isLoading && (
              <div className="toast toast-error" role="alert">
                <div className="toast-title">Noe gikk galt</div>
                <div className="toast-copy">{error}</div>
              </div>
            )}
          {isEmpty && (
              <div className="toast toast-empty" role="status">
                <div className="toast-title">{emptyTitle}</div>
                <div className="toast-copy">{emptyCopy}</div>
              </div>
            )}
        </main>
      </div>
    </div>
  );
}

export default App;
