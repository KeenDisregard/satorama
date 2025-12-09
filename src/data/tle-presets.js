/**
 * TLE Preset Loader
 * 
 * Provides access to bundled TLE catalog presets.
 * The catalog is refreshed weekly via GitHub Actions.
 */

// Import the bundled catalog (Vite handles JSON imports)
import catalog from './tle-catalog.json';

/**
 * Get list of available presets with metadata
 * @returns {Array<{id: string, name: string, count: number}>}
 */
export function getPresetList() {
    return Object.entries(catalog.presets).map(([id, preset]) => ({
        id,
        name: preset.name,
        count: preset.count
    }));
}

/**
 * Load satellite TLE data for a specific preset
 * @param {string} presetId - Preset ID (e.g., 'iss', 'gps', 'starlink')
 * @returns {Array<{name: string, tle1: string, tle2: string}>}
 * @throws {Error} If preset not found
 */
export function loadPreset(presetId) {
    const preset = catalog.presets[presetId];
    if (!preset) {
        throw new Error(`Preset not found: ${presetId}`);
    }
    return preset.satellites;
}

/**
 * Get the timestamp when the catalog was generated
 * @returns {string} ISO 8601 timestamp
 */
export function getCatalogTimestamp() {
    return catalog.generated;
}

/**
 * Get catalog metadata
 * @returns {{version: string, generated: string, source: string}}
 */
export function getCatalogInfo() {
    return {
        version: catalog.version,
        generated: catalog.generated,
        source: catalog.source
    };
}

/**
 * Check if a preset exists
 * @param {string} presetId 
 * @returns {boolean}
 */
export function hasPreset(presetId) {
    return presetId in catalog.presets;
}

export default {
    getPresetList,
    loadPreset,
    getCatalogTimestamp,
    getCatalogInfo,
    hasPreset
};
