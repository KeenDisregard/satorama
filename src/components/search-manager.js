/**
 * SearchManager - Handles searching for satellites and ground stations
 */
class SearchManager {
  constructor(app) {
    this.app = app;
  }

  /**
   * Search for objects matching the query
   * @param {string} query - Search query
   * @param {string} type - 'all', 'satellite', or 'groundstation'
   * @returns {Array} Array of matching results
   */
  search(query, type = 'all') {
    query = query.toLowerCase().trim();
    const results = [];

    // Search satellites if applicable
    if (type === 'all' || type === 'satellite') {
      const satelliteResults = this.app.satellites.filter(sat =>
        sat.tleData.name.toLowerCase().includes(query)
      ).map(sat => ({
        name: sat.tleData.name,
        type: 'satellite',
        objectType: sat.type,
        object: sat
      }));

      results.push(...satelliteResults);
    }

    // Search ground stations if applicable
    if (type === 'all' || type === 'groundstation') {
      const stationResults = this.app.groundStations.filter(station =>
        station.name.toLowerCase().includes(query)
      ).map(station => ({
        name: station.name,
        type: 'groundStation',
        location: `${station.lat.toFixed(2)}°, ${station.lon.toFixed(2)}°`,
        object: station
      }));

      results.push(...stationResults);
    }

    return results;
  }
}

export default SearchManager;
