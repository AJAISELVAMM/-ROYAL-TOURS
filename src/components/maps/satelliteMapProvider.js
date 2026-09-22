// =============================================================================
// satelliteMapProvider.js — legitimate, keyless Map Tile Provider Abstraction.
// Supports high-resolution Satellite Imagery (Esri World Imagery) and Street Map
// (OpenStreetMap) with proper attributions.
// =============================================================================

export const TILE_LAYERS = {
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    icon: 'globe',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  streets: {
    id: 'streets',
    name: 'Street Map',
    icon: 'map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }
};

export function getTileLayerConfig(layerType = 'satellite') {
  return TILE_LAYERS[layerType] || TILE_LAYERS.satellite;
}

export default TILE_LAYERS;
