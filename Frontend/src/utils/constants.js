export const DEFAULT_RADIUS = 5000;
export const DEFAULT_CENTER = [10.7522, 59.9139];
export const DEFAULT_ZOOM = 5.2;

export const SOURCE_IDS = {
  buildings: "buildings",
  upgradeBuildings: "upgrade-buildings",
  heatmapBuildings: "heatmap-buildings",
  energyTiles: "energy-tiles",
  selected: "selected-building",
  nearby: "nearby-buildings",
  nearbyCircle: "nearby-circle",
};

export const LAYER_IDS = {
  clusters: "clusters",
  clusterCount: "cluster-count",
  points: "unclustered-points",
  heatmap: "buildings-heatmap",
  heatmapLocations: "buildings-heatmap-locations",
  heatmapPoints: "buildings-heatmap-points",
  upgradePriorityPoints: "upgrade-priority-points",
  energyTilePoints: "energy-tile-points",
  energyTileClusters: "energy-tile-clusters",
  energyTileClusterCount: "energy-tile-cluster-count",
  energyTileStats: "energy-tile-stats",
  selectedHalo: "selected-building-halo",
  selectedPoint: "selected-building-point",
  nearby: "nearby-layer",
  nearbyCircle: "nearby-circle-layer",
};

export const LIGHT_MAP_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
export const DARK_MAP_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
export const MAP_STYLE_URL = LIGHT_MAP_STYLE_URL;
export const ENERGY_TILE_PATH = "/tiles/{z}/{x}/{y}.pbf";
export const ENERGY_TILE_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}${ENERGY_TILE_PATH}`
    : ENERGY_TILE_PATH;
export const ENERGY_TILE_SOURCE_LAYER = "points";
export const ENERGY_TILE_CLUSTER_SOURCE_LAYER = "clusters";
export const ENERGY_TILE_STATS_SOURCE_LAYER = "stats";
