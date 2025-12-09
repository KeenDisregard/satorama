#!/usr/bin/env node
/**
 * Fetch TLE data from CelesTrak and bundle into tle-catalog.json
 * 
 * Usage: node scripts/fetch-celestrak.js
 * 
 * Rate Limiting: CelesTrak allows 2 requests/hour per dataset.
 * This script respects rate limits with delays between requests.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// CelesTrak GP API endpoint
const CELESTRAK_API = 'https://celestrak.org/NORAD/elements/gp.php';

// Preset definitions with CelesTrak GROUP names
const PRESETS = [
    {
        id: 'iss',
        name: 'ISS (International Space Station)',
        group: 'stations',
        filter: (sat) => sat.OBJECT_NAME.includes('ISS (ZARYA)'),
        maxCount: 1
    },
    {
        id: 'stations',
        name: 'Space Stations',
        group: 'stations',
        maxCount: 10
    },
    {
        id: 'gps',
        name: 'GPS Constellation',
        group: 'gps-ops',
        maxCount: 50
    },
    {
        id: 'glonass',
        name: 'GLONASS Constellation',
        group: 'glo-ops',
        maxCount: 30
    },
    {
        id: 'galileo',
        name: 'Galileo Constellation',
        group: 'galileo',
        maxCount: 35
    },
    {
        id: 'weather',
        name: 'Weather Satellites',
        group: 'weather',
        maxCount: 100
    },
    {
        id: 'brightest',
        name: '100 Brightest',
        group: 'visual',
        maxCount: 100
    },
    {
        id: 'starlink',
        name: 'Starlink (Sample)',
        group: 'starlink',
        maxCount: 1000  // Performance limit
    },
    {
        id: 'oneweb',
        name: 'OneWeb',
        group: 'oneweb',
        maxCount: 700
    },
    {
        id: 'iridium',
        name: 'Iridium NEXT',
        group: 'iridium-NEXT',
        maxCount: 100
    }
];

/**
 * Fetch text data from URL with promise wrapper
 */
function fetchText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

/**
 * Parse 3LE text format into array of satellite objects
 * 3LE format: name line, TLE line 1, TLE line 2 (repeating)
 */
function parse3LE(text) {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const satellites = [];

    for (let i = 0; i + 2 < lines.length; i += 3) {
        const name = lines[i];
        const tle1 = lines[i + 1];
        const tle2 = lines[i + 2];

        // Validate TLE lines start with 1 and 2
        if (tle1.startsWith('1 ') && tle2.startsWith('2 ')) {
            satellites.push({ name, tle1, tle2 });
        }
    }

    return satellites;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main execution
 */
async function main() {
    console.log('🛰️  CelesTrak TLE Fetcher');
    console.log('========================\n');

    const catalog = {
        version: '1.0',
        generated: new Date().toISOString(),
        source: 'celestrak.org',
        presets: {}
    };

    // Track unique groups to avoid duplicate fetches
    const fetchedGroups = new Map();

    for (const preset of PRESETS) {
        console.log(`📡 Fetching: ${preset.name} (GROUP=${preset.group})`);

        try {
            // Check if we already fetched this group
            let satellites;
            if (fetchedGroups.has(preset.group)) {
                console.log(`   ↳ Using cached data for group: ${preset.group}`);
                satellites = fetchedGroups.get(preset.group);
            } else {
                // Use 3LE format (text) which includes actual TLE lines
                const url = `${CELESTRAK_API}?GROUP=${preset.group}&FORMAT=3LE`;
                const text = await fetchText(url);
                satellites = parse3LE(text);
                fetchedGroups.set(preset.group, satellites);

                // Rate limiting: wait 2 seconds between unique requests
                console.log(`   ↳ Fetched ${satellites.length} satellites`);
                await sleep(2000);
            }

            // Apply filter if specified (filter uses .name now)
            let filtered = satellites;
            if (preset.filter) {
                filtered = satellites.filter(sat => preset.filter({ OBJECT_NAME: sat.name }));
            }

            // Apply max count limit
            const limited = filtered.slice(0, preset.maxCount);

            catalog.presets[preset.id] = {
                name: preset.name,
                count: limited.length,
                satellites: limited
            };

            console.log(`   ✓ Saved ${limited.length} satellites\n`);

        } catch (error) {
            console.error(`   ✗ Error: ${error.message}\n`);
            // Continue with empty preset on error
            catalog.presets[preset.id] = {
                name: preset.name,
                count: 0,
                satellites: [],
                error: error.message
            };
        }
    }

    // Write output file
    const outputPath = path.join(__dirname, '..', 'src', 'data', 'tle-catalog.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2));

    console.log('========================');
    console.log(`✅ Catalog saved to: ${outputPath}`);
    console.log(`📅 Generated: ${catalog.generated}`);

    // Summary
    const totalSats = Object.values(catalog.presets).reduce((sum, p) => sum + p.count, 0);
    console.log(`📊 Total satellites: ${totalSats} across ${Object.keys(catalog.presets).length} presets`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
