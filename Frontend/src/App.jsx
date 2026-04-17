import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MapView from './components/MapView.jsx';
import Sidebar from './components/Sidebar.jsx';
import SearchBar from './components/SearchBar.jsx';
import { fetchBuildingsGeoJson, fetchNearbyBuildings } from './services/api.js';
import { useStore } from './store/useStore.js';
import {
  buildInitialFilterBounds,
  filterFeatures,
  getSearchSuggestions,
  normalizeGeoJson
} from './utils/filtering.js';
import './styles/app.css';

function extractErrorMessage(error, fallbackMessage) {
  const responseData = error?.response?.data;

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData;
  }

  if (responseData && typeof responseData === 'object') {
    if (typeof responseData.message === 'string' && responseData.message.trim()) {
      return responseData.message;
    }

    if (typeof responseData.title === 'string' && responseData.title.trim()) {
      return responseData.title;
    }
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function App() {
  const theme = useStore((state) => state.theme);
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const searchQuery = useStore((state) => state.searchQuery);
  const selectedFeature = useStore((state) => state.selectedFeature);
  const nearby = useStore((state) => state.nearby);
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
  const clearNearby = useStore((state) => state.clearNearby);
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const toggleTheme = useStore((state) => state.toggleTheme);
  const setSearchQuery = useStore((state) => state.setSearchQuery);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('theme-dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setError('');
        const payload = await fetchBuildingsGeoJson();
        if (!active) return;
        const normalized = normalizeGeoJson(payload);
        setAllFeatures(normalized.features);
        initializeFilters(buildInitialFilterBounds(normalized.features));
      } catch (loadError) {
        if (!active) return;
        setError(extractErrorMessage(loadError, 'Failed to load building data.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [initializeFilters, setAllFeatures, setError, setLoading]);

  const filteredFeatures = useMemo(
    () => filterFeatures(allFeatures, filters),
    [allFeatures, filters]
  );
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
  };

  const handleMapClick = async ({ latitude, longitude, radiusInMeters }) => {
    try {
      setIsSearchingNearby(true);
      setError('');
      const results = await fetchNearbyBuildings(latitude, longitude, radiusInMeters);
      setNearby({
        center: { latitude, longitude },
        radiusInMeters,
        results
      });
    } catch (nearbyError) {
      setError(extractErrorMessage(nearbyError, 'Failed to load nearby buildings.'));
      clearNearby();
    } finally {
      setIsSearchingNearby(false);
    }
  };

  const isEmpty = !isLoading && !error && filteredFeatures.length === 0;

  return (
    <div className={`app-shell ${theme === 'dark' ? 'theme-dark' : ''}`}>
      <div className="app-background" />
      <div className="app-layout">
        <Sidebar
          featureCount={filteredFeatures.length}
          totalCount={allFeatures.length}
          isSearchingNearby={isSearchingNearby}
        />
        <main className="app-main">
          <div className="top-overlay">
            <SearchBar
              sidebarOpen={sidebarOpen}
              suggestions={suggestions}
              onSuggestionSelect={handleSuggestionSelect}
              onToggleSidebar={toggleSidebar}
              onToggleTheme={toggleTheme}
            />
          </div>
          <MapView
            features={filteredFeatures}
            allFeaturesCount={allFeatures.length}
            selectedFeature={selectedFeatureFromList}
            nearbyState={nearby}
            onMapClick={handleMapClick}
            isSearchingNearby={isSearchingNearby}
          />
          <AnimatePresence>
            {isLoading && (
              <motion.div
                className="status-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="status-card">
                  <div className="spinner" />
                  <div>
                    <div className="status-title">Loading building data</div>
                    <div className="status-copy">Preparing map, layers, and filters.</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {error && !isLoading && (
              <motion.div
                className="toast toast-error"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
              >
                <div className="toast-title">Something went wrong</div>
                <div className="toast-copy">{error}</div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isEmpty && (
              <motion.div
                className="toast toast-empty"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
              >
                <div className="toast-title">No buildings match these filters</div>
                <div className="toast-copy">
                  Adjust the ranges or grade filters to bring results back.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
