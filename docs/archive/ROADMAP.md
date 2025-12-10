# Roadmap

This document outlines planned improvements and known areas for future development.

## Recently Completed

- [x] **Camera follow system** - Delta-based tracking that follows satellites smoothly at any speed
- [x] **Satellite trail visualization** - Shows path history for selected satellite
- [x] **Ground track projection** - Projects orbit path onto Earth surface
- [x] **Tooltip on hover** - Shows satellite/ground station info on mouseover
- [x] **Keyboard shortcuts** - Space (pause), R (reset), S/O/G/L (toggles), +/- (speed), Escape (deselect)
- [x] **Color legend** - Visual color indicators for satellite types
- [x] **Earth rotation tied to simulation time** - Stops when paused, scales with time multiplier
- [x] **Accurate Earth orientation** - GMST-based rotation synced to real-world time (sidereal day)

## Pre-Release Checklist

- [ ] **Create demo GIF/screenshot** for README hero image (replace placeholder at line 10)

## Testing Improvements

The current test suite covers utility controllers but lacks coverage for domain logic. The following areas need test coverage:

### High Priority

- [ ] **Satellite orbital calculations** (`src/components/satellite.js`)
  - Position calculation accuracy
  - Orbit path generation
  - TLE data parsing and validation
  
- [ ] **Line-of-sight calculations** (`src/components/line-of-sight.js`)
  - Visibility determination between ground stations and satellites
  - Edge cases at horizon boundaries
  
- [ ] **TLE generator** (`src/data/tle-generator.js`)
  - Validation of generated TLE format
  - Orbital parameter ranges for each satellite type (LEO, MEO, GEO, HEO)

### Medium Priority

- [ ] **Ground station** (`src/components/ground-station.js`)
  - Coordinate conversion (lat/lon to 3D position)
  - Earth rotation synchronization
  
- [ ] **Earth rendering** (`src/components/earth.js`)
  - Rotation calculations
  - Texture loading error handling

### Future Considerations

- [ ] **Integration tests** for `App` class orchestration
- [ ] **End-to-end tests** using Playwright or Cypress for UI interactions
- [ ] **Performance benchmarks** for large satellite counts

## Known Limitations

- **Satellite trail on tab background**: When browser tab is backgrounded and returned, the trail clears to prevent visual artifacts. Future improvement: interpolate missing positions to maintain trail continuity.
- **Trail/ground track during pause**: Updates are disabled when time is paused. Future improvement: allow scrubbing through historical trail data.
- **Visual jitter when paused**: Minor rendering jitter occurs when simulation is paused. Needs investigation - likely related to animation loop or interpolation logic.

## Feature Ideas

- [ ] Import real TLE data from CelesTrak or Space-Track
- [ ] Satellite search and filtering by NORAD ID
- [ ] Time picker for historical/future visualization
- [ ] Export camera views as screenshots
- [ ] Mobile touch controls

## Orbit Visualization Roadmap

Current implementation: **On-demand orbit lines** — orbit path computed only for selected satellite (360 SGP4 calls).

### Future Enhancements

- [ ] **Orbit prediction caching** — Cache computed orbit points to avoid recomputation on re-selection
- [ ] **Adaptive orbit resolution** — Use fewer points for distant/zoomed-out views, more for close-up
- [ ] **Instanced orbit lines** — Batch render multiple orbit lines with InstancedMesh/InstancedBufferGeometry
- [ ] **Past/future orbit segments** — Show completed orbit in different color from upcoming path
- [ ] **Orbit intersection visualization** — Highlight where orbits cross (conjunction analysis)
- [ ] **Orbit plane visualization** — Optional transparent disc showing orbital plane inclination
- [ ] **Apogee/perigee markers** — Visual indicators at orbital extremes for HEO satellites
- [ ] **Time-based orbit animation** — Animate a marker along the orbit path showing satellite's future positions

## Performance Enhancements

Future optimizations identified during Flight Readiness Review testing:

- [ ] **Worker message sequencing** — Add sequence numbers to worker messages to discard stale position updates; eliminates rare extrapolation glitches on time multiplier changes
- [ ] **LOS worker offload** — Move line-of-sight visibility calculations to SGP4 worker; would eliminate main-thread jitter on LOS updates by sending visibility bitmask alongside positions

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to these improvements.
