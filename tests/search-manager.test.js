import { describe, it, expect, beforeEach } from 'vitest';
import SearchManager from '../src/components/search-manager.js';

describe('SearchManager', () => {
  let searchManager;
  let mockApp;

  beforeEach(() => {
    // Create mock app with satellites and ground stations
    mockApp = {
      satellites: [
        { tleData: { name: 'ISS (ZARYA)' }, type: 'LEO' },
        { tleData: { name: 'STARLINK-1234' }, type: 'LEO' },
        { tleData: { name: 'GPS BIIR-2' }, type: 'MEO' },
        { tleData: { name: 'INTELSAT 901' }, type: 'GEO' }
      ],
      groundStations: [
        { name: 'Kennedy Space Center', lat: 28.5, lon: -80.6 },
        { name: 'Baikonur Cosmodrome', lat: 45.6, lon: 63.3 }
      ]
    };
    searchManager = new SearchManager(mockApp);
  });

  describe('search', () => {
    it('should find satellites by name (case-insensitive)', () => {
      const results = searchManager.search('iss');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('ISS (ZARYA)');
      expect(results[0].type).toBe('satellite');
    });

    it('should find ground stations by name', () => {
      const results = searchManager.search('kennedy');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Kennedy Space Center');
      expect(results[0].type).toBe('groundStation');
    });

    it('should return multiple matches', () => {
      const results = searchManager.search('star');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for no matches', () => {
      const results = searchManager.search('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should filter by satellite type only', () => {
      const results = searchManager.search('', 'satellite');
      expect(results.every(r => r.type === 'satellite')).toBe(true);
      expect(results).toHaveLength(4);
    });

    it('should filter by ground station type only', () => {
      const results = searchManager.search('', 'groundstation');
      expect(results.every(r => r.type === 'groundStation')).toBe(true);
      expect(results).toHaveLength(2);
    });

    it('should search all types by default', () => {
      const results = searchManager.search('');
      expect(results).toHaveLength(6); // 4 satellites + 2 ground stations
    });

    it('should trim whitespace from query', () => {
      const results = searchManager.search('  iss  ');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('ISS (ZARYA)');
    });

    it('should include object reference in results', () => {
      const results = searchManager.search('iss');
      expect(results[0].object).toBe(mockApp.satellites[0]);
    });

    it('should include satellite type (LEO/MEO/GEO) in results', () => {
      const results = searchManager.search('gps');
      expect(results[0].objectType).toBe('MEO');
    });

    it('should include location for ground stations', () => {
      const results = searchManager.search('kennedy');
      expect(results[0].location).toContain('28.50');
      expect(results[0].location).toContain('-80.60');
    });

    it('should handle partial matches in middle of name', () => {
      const results = searchManager.search('link'); // STAR*LINK*-1234
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('STARLINK-1234');
    });

    it('should handle special characters in search', () => {
      const results = searchManager.search('(zarya)');
      expect(results).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty satellites array', () => {
      mockApp.satellites = [];
      const results = searchManager.search('test', 'satellite');
      expect(results).toHaveLength(0);
    });

    it('should handle empty ground stations array', () => {
      mockApp.groundStations = [];
      const results = searchManager.search('test', 'groundstation');
      expect(results).toHaveLength(0);
    });

    it('should handle both arrays empty', () => {
      mockApp.satellites = [];
      mockApp.groundStations = [];
      const results = searchManager.search('');
      expect(results).toHaveLength(0);
    });
  });
});
