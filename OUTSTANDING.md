# Outstanding Work

> **Last Updated:** 2025-12-10  
> **Status:** v1.0 shipped (1,000 satellites max). Items below target v1.1 and v2.0.

---

## 🎯 Primary Goal: 100,000+ Objects @ 1000× Time Warp

> **Design Philosophy:** Build for 100k+ from the start. One architecture rebuild rather than incremental patches.

The current JavaScript SGP4 architecture hits fundamental limits at ~25,000 objects under high time warp. Rather than optimize for 25k and rebuild again later, v2.0 targets **100,000+ objects** with a tiered physics/rendering architecture.

### Milestone 1: Break the 25k Barrier
Current bottleneck: JavaScript SGP4 propagation on worker thread cannot keep up with 25k+ satellites at 1000× time warp.

### Milestone 2: Scale to 100,000+ Objects
Full v2.0 architecture enabling visualization of the entire tracked orbital catalog.

---

## v2.0 Tiered Architecture

### Tier 1: Simplified Keplerian Motion
- [ ] Use basic Keplerian mechanics (100× faster than SGP4) for bulk satellites
- [ ] Reserve SGP4 only for selected/tracked satellites needing accuracy
- [ ] Accuracy loss is imperceptible at visualization scale

### Tier 2: WebGPU Compute Shaders
- [ ] Offload propagation to GPU for massive parallelism
- [ ] Target: 10,000+ satellites propagated in <1ms
- [ ] Requires WebGPU-capable browser (fallback to Tier 1 otherwise)

### Tier 3: Pre-computed Trajectories
- [ ] Pre-calculate positions for 24-hour window on load
- [ ] Interpolate between keyframes for smooth motion
- [ ] Recompute only on TLE update

### Tier 4: Hybrid Priority System

| Satellite State | Physics Model | Update Rate |
|-----------------|---------------|-------------|
| Selected/Tracked | Full SGP4 | Every frame |
| Visible (<1000) | Chunked SGP4 | Every 5 ticks |
| Off-screen (rest) | Keplerian approx | Every 20 ticks |

*See [final_certification_review-2025-12-08.md](docs/archive/final_certification_review-2025-12-08.md) for full v2.0 architecture rationale.*

---

## v1.1 Performance Optimizations

*From [final_certification_review-2025-12-08.md](docs/archive/final_certification_review-2025-12-08.md) Recommended v1.1 Optimizations:*

- [ ] **Spatial indexing** (octree/BVH) for LOS visibility culling
- [ ] **Adaptive update rates** based on satellite count
- [ ] **LOD system** for orbit visualization
- [ ] **SharedArrayBuffer** for true zero-allocation worker transfers (requires COOP/COEP headers)
- [ ] **Worker constructor try-catch** for CSP failure handling (`app.js` line 272)

---

## Rendering Alternatives

*From [flight_readiness_2025-12-08.md](docs/archive/flight_readiness_2025-12-08.md):*

- [ ] **THREE.Points with custom shader** — Even better performance than InstancedMesh for satellite rendering

---

## Performance Enhancements

- [ ] **Worker message sequencing** — Add sequence numbers to discard stale position updates; eliminates rare extrapolation glitches on time multiplier changes
- [ ] **LOS worker offload** — Move line-of-sight calculations to SGP4 worker to eliminate main-thread jitter

---

## Orbit Visualization Enhancements

- [ ] Orbit prediction caching (avoid recomputation on re-selection)
- [ ] Adaptive orbit resolution (fewer points when zoomed out)
- [ ] Instanced orbit lines (batch render multiple orbits)
- [ ] Past/future orbit color segmentation
- [ ] Orbit intersection visualization (conjunction analysis)
- [ ] Orbit plane visualization (transparent disc)
- [ ] Apogee/perigee markers for HEO
- [ ] Time-based orbit animation (marker showing future positions)

---

## Testing Improvements

### High Priority
- [ ] **Satellite orbital calculations** (`src/components/satellite.js`)
  - Position calculation accuracy
  - Orbit path generation
  - TLE data parsing validation

- [ ] **Line-of-sight calculations** (`src/components/line-of-sight.js`)
  - Visibility determination accuracy
  - Horizon boundary edge cases

- [ ] **TLE generator** (`src/data/tle-generator.js`)
  - Generated TLE format validation
  - Orbital parameter ranges per type (LEO/MEO/GEO/HEO)

### Medium Priority
- [ ] **Ground station** (`src/components/ground-station.js`) — coordinate conversion tests
- [ ] **Earth rendering** (`src/components/earth.js`) — rotation and texture error handling

### Future
- [ ] Integration tests for `App` class
- [ ] E2E tests (Playwright/Cypress)
- [ ] Performance benchmarks for large satellite counts

---

## Feature Ideas

- [x] Import real TLE data from CelesTrak or Space-Track
- [ ] Satellite search and filtering by NORAD ID
- [ ] Time picker for historical/future visualization
- [ ] Export camera views as screenshots
- [ ] Mobile touch controls
- [ ] Demo GIF/screenshot for README hero image

---

## Known Limitations

| Limitation | Potential Fix |
|------------|---------------|
| Trail clears on tab return | Interpolate missing positions to maintain continuity |
| Trail/ground track frozen when paused | Allow scrubbing through historical data |
| Minor jitter when paused | Investigate animation loop / interpolation logic |

---

## Key Technical Insights

*Lessons learned from [final_certification_review-2025-12-08.md](docs/archive/final_certification_review-2025-12-08.md):*

**Jitter Root Cause (Extrapolation Cap):**
- Adding a 2-second extrapolation cap caused visible jitter at 1000 satellites
- When capped, satellites "freeze" at limit, then "snap forward" when fresh worker data arrives
- **Solution:** Remove cap; accept brief adjustment on extreme speed changes (1000x → 1x)

**Worker Communication Pattern Works When:**
1. Extrapolation is **uncapped** (linear motion continues until fresh data)
2. Worker updates are **consistent** (not chunked at small counts)
3. Time multiplier changes are **rare** (steady-state is the norm)

**Design Principle:** Attempts to optimize for edge cases (speed change snapping) degraded the common case (smooth motion). Prioritize the 99% case.

---

## Useful References

- [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/) — Classic game dev article on physics/render loop separation
- [Three.js InstancedMesh](https://threejs.org/docs/#api/en/objects/InstancedMesh) — API docs
- [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) — For zero-copy worker transfers

---

## Archived Documents

Previous review documents in `docs/archive/`:
- `final_certification_review-2025-12-08.md` — Technical audit of 4 subsystems
- `flight_readiness_2025-12-08.md` — 5-domain architecture review
- `open_source_readiness_audit.md` — OSS readiness prompt (audit completed)
- `PERFORMANCE_LESSONS_LEARNED.md` — Dec 6 optimization session notes
- `ROADMAP.md` — Original roadmap (superseded by this file)

