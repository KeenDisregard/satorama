import * as THREE from 'three';

/**
 * SatelliteTrail - Visualizes the recent path of a selected satellite
 * Creates a gradient-colored line that fades from old to new positions
 */
class SatelliteTrail {
  constructor(scene) {
    this.scene = scene;
    this.target = null;
    this.trail = null;
    this.trailPoints = [];
    this.maxPoints = 200;
    this.visible = true;
    
    // Trail appearance
    this.trailColor = new THREE.Color(0x00ffff);
    
    // Throttling
    this.lastUpdateTime = 0;
    this.updateInterval = 50; // Only add points every 50ms
    
    // Track simulation time for discontinuity detection (tab backgrounding)
    this.lastSimTime = null;
  }

  /**
   * Set the satellite to track
   * @param {Object} satellite - Satellite object to track
   */
  setTarget(satellite) {
    this.clearTrail();
    this.target = satellite;
    
    if (satellite) {
      // Initialize with current position
      this.trailPoints = [];
      this.createTrailMesh();
    }
  }

  /**
   * Create or update the trail mesh
   */
  createTrailMesh() {
    // Remove existing trail if present
    if (this.trail) {
      this.scene.remove(this.trail);
      if (this.trail.geometry) this.trail.geometry.dispose();
      if (this.trail.material) this.trail.material.dispose();
    }

    if (this.trailPoints.length < 2) return;

    // Create geometry from trail points
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.trailPoints.length * 3);
    const colors = new Float32Array(this.trailPoints.length * 3);

    for (let i = 0; i < this.trailPoints.length; i++) {
      const point = this.trailPoints[i];
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;

      // Gradient: fade from dim (old) to bright (new)
      const alpha = i / (this.trailPoints.length - 1);
      colors[i * 3] = this.trailColor.r * alpha;
      colors[i * 3 + 1] = this.trailColor.g * alpha;
      colors[i * 3 + 2] = this.trailColor.b * alpha;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create material with vertex colors
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      linewidth: 2
    });

    this.trail = new THREE.Line(geometry, material);
    this.trail.visible = this.visible;
    this.scene.add(this.trail);
  }

  /**
   * Update the trail with current satellite position
   * @param {Date} simulationTime - Current simulation time
   */
  update(simulationTime) {
    if (!this.target || !this.target.mesh) return;

    // Throttle updates
    const now = performance.now();
    if (now - this.lastUpdateTime < this.updateInterval) return;
    
    // Detect simulation time discontinuity (caused by tab backgrounding)
    // When browser tab is inactive, requestAnimationFrame pauses but simulation time jumps
    // This creates artifacts where trail connects pre/post-background positions with a straight line
    const wallDelta = now - this.lastUpdateTime;
    // Only check for discontinuity if wall time gap is significant (>1s = actual backgrounding)
    if (wallDelta > 1000 && this.lastSimTime && simulationTime) {
      const simDelta = Math.abs(simulationTime.getTime() - this.lastSimTime.getTime());
      // At max 100x speed, 1s wall = 100s sim. Clear if sim jumped more than expected.
      const maxExpectedSimDelta = wallDelta * 150;
      if (simDelta > maxExpectedSimDelta) {
        // Clear trail to prevent artifact from stale points
        this.trailPoints = [];
      }
    }
    this.lastSimTime = simulationTime ? new Date(simulationTime.getTime()) : null;
    
    this.lastUpdateTime = now;

    // Get current satellite position
    const pos = this.target.mesh.position.clone();

    // Add to trail points
    this.trailPoints.push(pos);

    // Limit trail length
    if (this.trailPoints.length > this.maxPoints) {
      this.trailPoints.shift();
    }

    // Update trail mesh
    this.updateTrailGeometry();
  }

  /**
   * Update existing geometry instead of recreating
   */
  updateTrailGeometry() {
    if (this.trailPoints.length < 2) {
      if (this.trail) this.trail.visible = false;
      return;
    }

    // Create trail if it doesn't exist
    if (!this.trail) {
      const geometry = new THREE.BufferGeometry();
      // Pre-allocate for max points
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxPoints * 3), 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.maxPoints * 3), 3));
      geometry.setDrawRange(0, 0);
      
      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8
      });
      
      this.trail = new THREE.Line(geometry, material);
      this.scene.add(this.trail);
    }

    // Update buffer data
    const positions = this.trail.geometry.attributes.position.array;
    const colors = this.trail.geometry.attributes.color.array;
    const count = this.trailPoints.length;

    for (let i = 0; i < count; i++) {
      const point = this.trailPoints[i];
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;

      const alpha = i / (count - 1);
      colors[i * 3] = this.trailColor.r * alpha;
      colors[i * 3 + 1] = this.trailColor.g * alpha;
      colors[i * 3 + 2] = this.trailColor.b * alpha;
    }

    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
    this.trail.geometry.setDrawRange(0, count);
    this.trail.visible = this.visible;
  }

  /**
   * Clear the trail
   */
  clearTrail() {
    this.target = null;
    this.trailPoints = [];

    if (this.trail) {
      this.scene.remove(this.trail);
      if (this.trail.geometry) this.trail.geometry.dispose();
      if (this.trail.material) this.trail.material.dispose();
      this.trail = null;
    }
  }

  /**
   * Toggle trail visibility
   * @param {boolean} visible - Whether trail should be visible
   */
  toggleVisibility(visible) {
    this.visible = visible;
    if (this.trail) {
      this.trail.visible = visible;
    }
  }

  /**
   * Set trail color based on satellite type
   * @param {string} type - Satellite type (LEO, MEO, GEO, HEO)
   */
  setColorByType(type) {
    const colors = {
      LEO: 0x00ffff,
      MEO: 0xffff00,
      GEO: 0xff00ff,
      HEO: 0xff0000
    };
    this.trailColor = new THREE.Color(colors[type] || 0xffffff);
  }
}

export default SatelliteTrail;
