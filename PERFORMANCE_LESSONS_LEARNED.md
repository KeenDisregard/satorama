# Performance Optimization Lessons Learned

> **📁 ARCHIVED:** This document captures lessons from Dec 6, 2025. As of Dec 8, 2025:
> - ✅ Web Worker for SGP4 — **Implemented** (`src/workers/sgp4-worker.js`)
> - ✅ Transferable ArrayBuffer — **Implemented**
> - ✅ Velocity extrapolation — **Implemented** (replaced lerp)
> - ❌ InstancedMesh — Attempted but reverted; re-implementing in FRR remediation
> - ❌ LOS instancing — Still outstanding
> 
> See `flight_readiness_2025-12-08.md` for current status.

## Session Summary
Date: Dec 6, 2025
Test Environment: Windows workstation, 64GB RAM, GTX 1060 6GB
Test Case: 2500 satellites with orbits/LOS disabled

---

## Key Findings

### 1. GPU Rendering is NOT the Bottleneck
- **InstancedMesh works**: Reduced draw calls from ~5000+ to **8**
- GPU handles 2500+ satellites easily with proper instancing
- Draw calls, triangles, geometries all minimal with InstancedMesh

### 2. CPU-bound SGP4 is THE Bottleneck
- `satellite.propagate()` called for every satellite
- 2500 calls × ~0.02ms each = ~50ms per full update
- This blocks the main thread regardless of GPU optimization

### 3. Line-of-Sight Creates Thousands of Objects
- **Major discovery**: LOS was creating cylinder meshes for EACH visible line
- 4 ground stations × hundreds of visible satellites = thousands of objects
- This alone caused 5000+ draw calls when enabled
- **Must fix**: Use instanced lines or pre-allocated line pool

### 4. Batching Causes Visual Artifacts
- Spreading SGP4 across frames causes different satellites to update at different times
- Creates "shimmering" or inconsistent motion
- All-at-once updates look better even if less frequent

### 5. Fixed Timestep + Interpolation Helps But Not Enough
- Classic game dev pattern: physics at fixed rate, render interpolates
- Implemented: 150ms physics, lerp every frame
- Still not smooth enough — interpolation itself is expensive for 2500 objects

---

## What Worked

| Optimization | Impact | Notes |
|--------------|--------|-------|
| InstancedMesh | ★★★★★ | Reduced draw calls from 5000+ to 8 |
| Disable antialiasing | ★★★ | Noticeable FPS improvement |
| Cap pixel ratio | ★★ | Helps on HiDPI displays |
| MeshBasicMaterial | ★★ | No lighting calculations |
| Reduced geometry segments | ★ | 4x4 sphere instead of 8x8 |

## What Didn't Work Well

| Approach | Issue |
|----------|-------|
| Batched updates (100-500/frame) | Visual inconsistency, satellites update at different times |
| Very low update frequency (200ms+) | Noticeable "ticking" motion |
| Interpolation on main thread | Still 2500 lerp operations per frame |

---

## Root Cause Analysis

```
Main Thread Workload per Frame:
├── SGP4 propagation (150ms intervals): ~50ms spike
├── Interpolation (every frame): ~10-20ms  ← Still too much
├── Matrix updates: ~5ms
├── Three.js render: ~5ms
└── Everything else: ~5ms
    
Total: Spikes to 70ms+ on physics frames = <15 FPS felt
```

The problem: Even with interpolation, we're doing 2500 lerp operations + 2500 matrix updates every frame on the main thread.

---

## Recommended Architecture (Next Attempt)

### Option A: Web Worker for SGP4 (Best)
```
Main Thread                    Web Worker
    │                              │
    │── Request positions ────────>│
    │                              │── SGP4 for all satellites
    │<──── Position buffer ────────│
    │                              │
    │── Interpolate + render       │
```
- Move ALL SGP4 calculations to Web Worker
- Use SharedArrayBuffer or transferable ArrayBuffer
- Main thread only does interpolation and rendering

### Option B: GPU Compute (WebGPU/Compute Shaders)
- Move position calculations to GPU
- Not widely supported yet, but future-proof

### Option C: Hybrid Approach
- Web Worker calculates positions
- Pass Float32Array directly to InstancedMesh
- Skip per-satellite JavaScript object updates

---

## Code Changes Made (To Revert)

### Files Modified:
1. `src/app.js` - SatelliteManager integration, renderer settings, animate loop
2. `src/components/satellite-manager.js` - NEW FILE (InstancedMesh implementation)
3. `src/components/satellite.js` - Still exists but unused
4. `src/components/line-of-sight.js` - Position access compatibility
5. `src/components/satellite-trail.js` - Position access compatibility
6. `src/components/camera-controller.js` - Position access compatibility
7. `src/components/search-manager.js` - satelliteManager.satellites access
8. `index.html` - Slider defaults, checkbox defaults
9. `vite.config.js` - host: true for LAN access

### Key Architectural Changes:
- Satellites changed from individual Mesh objects to InstancedMesh instances
- Satellite data changed from class instances to plain objects
- Position stored as THREE.Vector3 instead of mesh.position
- Added interpolation system (previousPosition, currentPosition, position)

---

## For Next Session

### Priority 1: Web Worker Implementation
1. Create `src/workers/sgp4-worker.js`
2. Move TLE parsing and propagation to worker
3. Use transferable ArrayBuffer for positions
4. Main thread only handles interpolation + GPU upload

### Priority 2: Fix Line-of-Sight
1. Use InstancedMesh for LOS lines (like satellites)
2. Or use a single merged BufferGeometry
3. Pre-allocate maximum expected lines

### Priority 3: Consider Position Extrapolation
- Instead of interpolation, extrapolate based on orbital velocity
- More accurate for orbital mechanics than linear lerp

---

## Performance Targets

| Metric | Current | Target |
|--------|---------|--------|
| Draw calls | 8 | <20 (with LOS) |
| FPS at 2500 sats | ~30 (jagged) | 60 (smooth) |
| FPS at 10000 sats | untested | 30+ |
| Physics update cost | ~50ms | <5ms (worker) |
| Render interpolation | ~15ms | <5ms |

---

## References

- [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/) - Classic game dev article
- [Three.js InstancedMesh](https://threejs.org/docs/#api/en/objects/InstancedMesh)
- [Web Workers + Three.js](https://threejs.org/docs/#manual/en/introduction/How-to-use-WebGL2)
- [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
