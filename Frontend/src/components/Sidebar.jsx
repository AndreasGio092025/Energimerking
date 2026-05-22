import { useStore } from '../store/useStore.js';
import Filters from './Filters.jsx';
import '../styles/sidebar.css';

function Sidebar({ featureCount, totalCount, isSearchingNearby }) {
  const sidebarOpen = useStore((state) => state.sidebarOpen);

  return (
    <aside className={`sidebar-shell ${sidebarOpen ? 'is-open' : 'is-closed'}`}>
      <div className="sidebar-panel">
        <div className="sidebar-top">
          <div className="stats-grid">
            <div className="stat-card">
              <span>Visible</span>
              <strong>{featureCount.toLocaleString()}</strong>
            </div>
            <div className="stat-card">
              <span>Loaded</span>
              <strong>{totalCount.toLocaleString()}</strong>
            </div>
          </div>

          {isSearchingNearby && (
            <div className="sidebar-alert">
              Searching nearby buildings for the clicked map location.
            </div>
          )}
        </div>

        <div className="sidebar-scroll">
          <Filters />
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
