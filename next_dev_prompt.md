# Handoff Prompt: Satellite Visualizer Follow Camera & Bug Fixes

## Context
This is a Three.js satellite visualizer with Earth, satellites (LEO, MEO, GEO, HEO), ground stations, and line-of-sight calculations. Built with Vite, Three.js, and satellite.js.

## Tasks Completed in This Session

### 1. Vite Port Configuration
**Problem:** Default port 3000 was in use.
**Solution:** Updated [vite.config.js](cci:7://file:///c:/Users/sys_elevator_errday/CascadeProjects/visualizer-nouveau-2/vite.config.js:0:0-0:0) and [package.json](cci:7://file:///c:/Users/sys_elevator_errday/CascadeProjects/visualizer-nouveau-2/package.json:0:0-0:0) to use port 5178.

### 2. Satellite Follow Camera Improvements
**Problem:** The "Follow Object" feature locked the camera in place and didn't allow orbiting around the satellite.

**Solution:** Rewrote the follow system to:
- Keep OrbitControls enabled while following
- Move both camera AND controls.target by the same delta each frame (preserves spherical offset)
- Track satellite position using `lastFollowTargetPos` for reliable delta calculation
- Position camera OUTSIDE the orbit (away from Earth) when starting follow, so Earth is visible behind satellite
- Call [updateCameraFollow()](cci:1://file:///c:/Users/sys_elevator_errday/CascadeProjects/visualizer-nouveau-2/src/app.js:613:2-641:3) BEFORE [controls.update()](cci:1://file:///c:/Users/sys_elevator_errday/CascadeProjects/visualizer-nouveau-2/src/components/ground-track.js:93:2-142:3) in the animate loop

**Key code pattern in [updateCameraFollow()](cci:1://file:///c:/Users/sys_elevator_errday/CascadeProjects/visualizer-nouveau-2/src/app.js:613:2-641:3):**
```javascript
const targetPos = this.getTargetPosition(this.followTarget).clone();
const delta = targetPos.clone().sub(this.lastFollowTargetPos);
this.lastFollowTargetPos.copy(targetPos);
if (delta.lengthSq() < 0.1) return;
this.camera.position.add(delta);
this.controls.target.copy(targetPos);
```

### 3. Ground Track Geometry Disposal Bug Fix
**Problem:** Animation loop crashed with error: `can't access property "dispose", this.groundTrack.geometry is undefined`

**Root cause:** `groundTrack` and `futureTrack` are THREE.Group objects (containing multiple Line children), not Line objects directly. Code was calling `.geometry.dispose()` on Groups which don't have geometry.

**Solution:** In [src/components/ground-track.js](cci:7://file:///c:/Users/sys_elevator_errday/CascadeProjects/visualizer-nouveau-2/src/components/ground-track.js:0:0-0:0), replace direct `.geometry.dispose()` calls with:
```javascript
this.groundTrack.traverse(child => {
  if (child.geometry) child.geometry.dispose();
});
```
Apply this fix in both [updateTrackMesh()](cci:1://file:///c:/Users/sys_elevator_errday/CascadeProjects/visualizer-nouveau-2/src/components/ground-track.js:144:2-199:3) and [clearTrack()](cci:1://file:///c:/Users/sys_elevator_errday/CascadeProjects/visualizer-nouveau-2/src/components/ground-track.js:233:2-256:3) methods.

### 4. Satellite Trail Safety Checks
**File:** [src/components/satellite-trail.js](cci:7://file:///c:/Users/sys_elevator_errday/CascadeProjects/visualizer-nouveau-2/src/components/satellite-trail.js:0:0-0:0)
**Solution:** Add null checks before disposing:
```javascript
if (this.trail.geometry) this.trail.geometry.dispose();
if (this.trail.material) this.trail.material.dispose();
```

### 5. Prevent Deselection While Following
**Problem:** Clicking to orbit the camera would deselect the satellite and stop following.

**Solution:** In [handleObjectSelection()](cci:1://file:///c:/Users/sys_elevator_errday/CascadeProjects/visualizer-nouveau-2/src/app.js:358:2-401:3), only clear selection if NOT following:
```javascript
} else if (event && event.target === this.renderer.domElement) {
  if (!this.followTarget) {  // <-- Add this check
    this.selectedObject = null;
    // ... rest of deselection code
  }
}
```

### 6. Don't Snap Camera on Stop Following
**Problem:** Stopping follow would reset camera to Earth center.

**Solution:** In [toggleFollow()](cci:1://file:///c:/Users/sys_elevator_errday/CascadeProjects/visualizer-nouveau-2/src/app.js:524:2-581:3), when stopping follow, just set `this.followTarget = null` without resetting `controls.target` to (0,0,0). Let camera stay where it is.

### 7. Always Update Followed Satellite
**Problem:** If satellite type was filtered out (e.g., LEO unchecked), followed satellite wouldn't update position.

**Solution:** In animate loop's satellite update:
```javascript
const isFollowed = this.followTarget === satellite;
if (this.isSatelliteVisible(satellite) || isFollowed) {
  satellite.update(...);
}
```

## New Properties Added to App Class
```javascript
this.lastFollowTargetPos = new THREE.Vector3(); // Track last known target position
this.followCameraOffset = new THREE.Vector3(0, 0, 3000); // Dynamic offset during follow
```

## Files Modified
- `vite.config.js` - port 5178
- `package.json` - dev script port
- `src/app.js` - follow camera logic, animate loop order, selection handling
- `src/components/ground-track.js` - geometry disposal fix
- `src/components/satellite-trail.js` - safety checks for disposal
- `index.html` - extensive UI overhaul with glass-morphism styling

## NEW FILES CREATED (from previous session - need to be recreated)

These files were created in a previous session and need to be recreated from scratch:

### 1. `src/components/starfield.js`
Creates a procedural starfield background using THREE.Points with randomized star positions and sizes. Adds depth and space atmosphere to the scene.

### 2. `src/components/sun.js`
Creates a Sun visualization with:
- Bright yellow/orange sphere
- Glow effect using sprite
- Corona effect
- Positioned far from Earth to simulate realistic lighting direction
- `getMesh()` method to add to scene

### 3. `src/components/satellite-trail.js`
Visualizes the recent path of a selected satellite:
- Stores trail points as satellite moves
- Creates gradient-colored line (fades from old to new)
- `setTarget(satellite)` - sets which satellite to track
- `update(simulationTime)` - updates trail points
- `clearTrail()` - removes trail
- `toggleVisibility(visible)` - show/hide
- Uses `THREE.Line` with `THREE.BufferGeometry`

### 4. `src/components/ground-track.js`
Projects satellite path onto Earth's surface:
- Shows past track (solid line) and future track (dashed line)
- Handles dateline crossing by breaking into segments
- Position marker showing current ground position
- `setTarget(satellite)` - sets satellite to track
- `update(simulationTime)` - recalculates track
- `clearTrack()` - removes track
- Uses `THREE.Group` containing multiple `THREE.Line` objects (important for disposal!)

### 5. `src/components/tooltip.js`
Hover tooltip for satellites and ground stations:
- Shows on mousemove when hovering over objects
- Displays satellite info: name, type, altitude, period, inclination
- Displays ground station info: name, location, visible satellite count
- `show(x, y, data)` - display tooltip at screen position
- `hide()` - hide tooltip
- `updatePosition(x, y)` - move tooltip with cursor
- Creates DOM element dynamically

## UI Enhancements (index.html)

### Glass-morphism Styling
```css
.glass-panel {
  background: rgba(10, 15, 25, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
```

### New UI Elements Added
1. **Color Legend** (`#color-legend`) - Shows satellite type colors (LEO=cyan, MEO=yellow, GEO=magenta, HEO=red, Ground Station=green)
2. **Keyboard Shortcuts Panel** (`#shortcuts-panel`) - Toggleable panel showing all shortcuts
3. **Shortcuts Toggle Button** (`#shortcuts-toggle`) - Button to show/hide shortcuts panel

### Keyboard Shortcuts (in `src/index.js`)
Added `setupKeyboardShortcuts(app)` function with:
- `Ctrl+F` - Open search
- `Escape` - Close panels
- `Space` - Toggle play/pause
- `R` - Reset camera
- `S` - Toggle satellites
- `O` - Toggle orbits
- `G` - Toggle ground stations
- `?` - Show shortcuts panel
- `+` / `-` - Speed up / slow down time

## App.js Integration Points

When recreating, add these imports to `app.js`:
```javascript
import Starfield from './components/starfield.js';
import Sun from './components/sun.js';
import SatelliteTrail from './components/satellite-trail.js';
import GroundTrack from './components/ground-track.js';
import Tooltip from './components/tooltip.js';
```

Add these properties to constructor:
```javascript
this.starfield = null;
this.sun = null;
this.satelliteTrail = null;
this.groundTrack = null;
this.tooltip = null;
this.hoveredObject = null;
```

In `init()`, after creating Earth:
```javascript
// Create starfield background
this.starfield = new Starfield();
this.scene.add(this.starfield.getMesh());

// Create Sun
this.sun = new Sun();
this.scene.add(this.sun.getMesh());

// Initialize satellite trail tracker
this.satelliteTrail = new SatelliteTrail(this.scene);

// Initialize ground track
this.groundTrack = new GroundTrack(this.scene, this.earth.radius);

// Initialize tooltip
this.tooltip = new Tooltip();
```

Add mousemove handler for hover/tooltip:
```javascript
this.renderer.domElement.addEventListener('mousemove', (event) => {
  const rect = this.renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  this.handleHover(x, y, event.clientX, event.clientY);
});

this.renderer.domElement.addEventListener('mouseleave', () => {
  this.tooltip.hide();
  this.hoveredObject = null;
});
```

In `updateSelectedInfo()`, when a satellite is selected:
```javascript
this.satelliteTrail.setTarget(satellite);
this.groundTrack.setTarget(satellite);
```

In animate loop, update trail and ground track:
```javascript
if (this.selectedObject instanceof Satellite) {
  this.satelliteTrail.update(this.simulationTime.current);
  this.groundTrack.update(this.simulationTime.current);
}
```

When deselecting, clear them:
```javascript
this.satelliteTrail.clearTrail();
this.groundTrack.clearTrack();
```
