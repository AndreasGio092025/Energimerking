import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store/useStore.js';
import '../styles/searchbar.css';

function SearchBar({ sidebarOpen, suggestions, onSuggestionSelect, onToggleSidebar, onToggleTheme }) {
  const theme = useStore((state) => state.theme);
  const searchQuery = useStore((state) => state.searchQuery);
  const setSearchQuery = useStore((state) => state.setSearchQuery);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleWindowClick(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    }

    window.addEventListener('mousedown', handleWindowClick);
    return () => window.removeEventListener('mousedown', handleWindowClick);
  }, []);

  const visibleSuggestions = useMemo(() => suggestions.slice(0, 7), [suggestions]);

  return (
    <div className="search-layout">
      <div className="search-left">
        <button type="button" className="chrome-button icon-button" onClick={onToggleSidebar} aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}>
          {sidebarOpen ? 'X' : '='}
        </button>

        <div className="search-wrapper" ref={wrapperRef}>
          <div className="search-shell">
            <span className="search-icon">S</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search by adresse, poststed, or kommunenavn"
            />
            {searchQuery && (
              <button type="button" className="inline-ghost" onClick={() => {
                setSearchQuery('');
                setOpen(false);
              }}>
                Clear
              </button>
            )}
          </div>

          <AnimatePresence>
            {open && searchQuery.trim() && (
              <motion.div className="suggestions-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
                {visibleSuggestions.length > 0 ? (
                  visibleSuggestions.map((feature) => (
                    <button key={feature.id} type="button" className="suggestion-item" onClick={() => {
                      onSuggestionSelect(feature);
                      setOpen(false);
                    }}>
                      <span className="suggestion-dot" />
                      <span className="suggestion-copy">
                        <strong>{feature.properties.adresse || 'Unknown address'}</strong>
                        <small>
                          {feature.properties.poststed || 'Unknown place'} | {feature.properties.kommunenavn || 'Unknown municipality'}
                        </small>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="suggestions-empty">No matching buildings found.</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <button type="button" className="chrome-button" onClick={onToggleTheme}>
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
    </div>
  );
}

export default SearchBar;
