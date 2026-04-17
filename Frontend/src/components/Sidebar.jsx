import { motion } from 'framer-motion';
import { useStore } from '../store/useStore.js';
import Filters from './Filters.jsx';
import '../styles/sidebar.css';

function Sidebar({ featureCount, totalCount, isSearchingNearby }) {
  const sidebarOpen = useStore((state) => state.sidebarOpen);

  return (
    <motion.aside
      className="sidebar-shell"
      animate={{ width: sidebarOpen ? 360 : 0, opacity: sidebarOpen ? 1 : 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
    >
      <div className="sidebar-panel">
        <div className="sidebar-top">
          <div className="sidebar-hero">
            <div className="sidebar-hero-inner">
              <div className="eyebrow">Energy intelligence</div>
              <h1>Building performance dashboard</h1>
              <p>
                Explore clustered building data, filter energy patterns, and inspect
                nearby results from your ASP.NET Core API.
              </p>
            </div>
          </div>

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
              Searching the nearby endpoint for the clicked map location.
            </div>
          )}
        </div>

        <div className="sidebar-scroll">
          <Filters />
        </div>
      </div>
    </motion.aside>
  );
}

export default Sidebar;
