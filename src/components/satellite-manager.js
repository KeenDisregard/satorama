import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { getSatelliteTypeColor } from '../utils.js';

/**
 * SatelliteManager - High-performance satellite rendering using InstancedMesh
 * 
 * Reduces draw calls from N (one per satellite) to 1 by using GPU instancing.
 * Maintains backward compatibility by giving each satellite a .mesh.position proxy.
 * 
 * Performance: 10,000 satellites = 1 draw call instead of 10,000+
 */
class SatelliteManager {
  constructor(scene, maxSatellites = 10000) {
    this.scene = scene;
    this.maxSatellites = maxSatellites;
    this.satellites = [];

    // Shared geometry for all satellites (low-poly sphere)
    this.geometry = new THREE.SphereGeometry(100, 6, 6);

    // Material with vertex colors for per-instance coloring
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: false,
      toneMapped: false
    });

    // The single InstancedMesh that renders all satellites
    this.instancedMesh = null;

    // Reusable matrix and color for updates
    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._scale = new THREE.Vector3(1, 1, 1);
    this._color = new THREE.Color();

    // Hitbox mesh for raycasting (invisible, shared geometry)
    this.hitboxGeometry = new THREE.SphereGeometry(200, 4, 4);
    this.hitboxMaterial = new THREE.MeshBasicMaterial({ visible: false });
    this.hitboxes = []; // Individual hitboxes for raycasting
  }

  /**
   * Initialize the instanced mesh for the given satellite count
   */
  initialize(count) {
    // Remove existing instanced mesh
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.dispose();
    }

    // Remove existing hitboxes
    for (const hitbox of this.hitboxes) {
      this.scene.remove(hitbox);
    }
    this.hitboxes = [];

    // Create new instanced mesh
    this.instancedMesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      count
    );
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Enable per-instance colors
    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 3),
      3
    );
    this.instancedMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

    this.scene.add(this.instancedMesh);

    // Initialize all instances to hidden (scale 0)
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < count; i++) {
      this.instancedMesh.setMatrixAt(i, zeroMatrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Add a satellite to the manager
   * Returns a satellite-like object with .mesh.position for compatibility
   */
  addSatellite(tleData, index, satrec, orbitParams) {
    // Expand InstancedMesh capacity if needed (for custom TLE additions)
    if (this.instancedMesh && index >= this.instancedMesh.count) {
      this._expandCapacity(index + 1);
    }

    const type = this.determineSatelliteType(satrec);
    const color = getSatelliteTypeColor(type);

    // Create a proxy object that mimics the old Satellite interface
    const satellite = {
      tleData,
      satrec,
      type,
      color,
      orbit: orbitParams,
      workerIndex: index,
      visible: true,

      // Proxy mesh object for backward compatibility
      mesh: {
        position: new THREE.Vector3(),
        visible: true,
        scale: new THREE.Vector3(1, 1, 1)
      },

      // Hitbox will be assigned below
      hitbox: null,

      // Orbit line (created separately, can be null for performance)
      orbitLine: null,

      // Methods for compatibility
      toggleVisibility: (visible) => {
        satellite.visible = visible;
        satellite.mesh.visible = visible;
        if (satellite.hitbox) {
          satellite.hitbox.visible = visible;
        }
        if (satellite.orbitLine) {
          satellite.orbitLine.visible = false; // Hide orbit when sat hidden
        }
      },

      toggleOrbit: (visible) => {
        if (satellite.orbitLine) {
          satellite.orbitLine.visible = visible && satellite.visible;
        }
      }
    };

    // Create hitbox for raycasting
    const hitbox = new THREE.Mesh(this.hitboxGeometry, this.hitboxMaterial);
    hitbox.userData = {
      name: tleData.name,
      type: type,
      satellite: satellite,
      satelliteIndex: index
    };
    satellite.hitbox = hitbox;
    this.hitboxes.push(hitbox);
    this.scene.add(hitbox);

    // Set instance color
    this._color.setHex(color);
    this.instancedMesh.setColorAt(index, this._color);

    this.satellites.push(satellite);
    return satellite;
  }

  /**
   * Expand the InstancedMesh capacity to accommodate more satellites
   * @private
   */
  _expandCapacity(newCount) {
    if (!this.instancedMesh) return;

    const oldCount = this.instancedMesh.count;
    if (newCount <= oldCount) return;

    // Create new InstancedMesh with larger capacity
    const newMesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      newCount
    );
    newMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Enable per-instance colors
    newMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(newCount * 3),
      3
    );
    newMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

    // Copy existing matrices and colors
    for (let i = 0; i < oldCount; i++) {
      this.instancedMesh.getMatrixAt(i, this._matrix);
      newMesh.setMatrixAt(i, this._matrix);

      this.instancedMesh.getColorAt(i, this._color);
      newMesh.setColorAt(i, this._color);
    }

    // Initialize new instances to hidden (scale 0)
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = oldCount; i < newCount; i++) {
      newMesh.setMatrixAt(i, zeroMatrix);
    }

    newMesh.instanceMatrix.needsUpdate = true;
    newMesh.instanceColor.needsUpdate = true;

    // Swap meshes
    this.scene.remove(this.instancedMesh);
    this.instancedMesh.dispose();
    this.instancedMesh = newMesh;
    this.scene.add(this.instancedMesh);
  }

  /**
   * Determine satellite type from satrec
   */
  determineSatelliteType(satrec) {
    const mm = satrec.no; // mean motion (rad/min)
    const mmRadPerSec = mm / 60;
    const earthRadius = 6378.137;
    const mu = 398600.4418;
    const a = Math.pow(mu / (mmRadPerSec * mmRadPerSec), 1 / 3);
    const e = satrec.ecco;

    const GEO_SMA = earthRadius + 35786;
    const LEO_MAX_SMA = earthRadius + 2000;

    if (e > 0.25) return 'HEO';
    if (Math.abs(a - GEO_SMA) < 1000 && e < 0.01) return 'GEO';
    if (a < LEO_MAX_SMA) return 'LEO';
    return 'MEO';
  }

  /**
   * Sync all satellite positions to the instanced mesh
   * Call this once per frame after positions are updated
   */
  syncToGPU() {
    if (!this.instancedMesh) return;

    for (let i = 0; i < this.satellites.length; i++) {
      const sat = this.satellites[i];
      const pos = sat.mesh.position;

      // Update hitbox position (for raycasting)
      if (sat.hitbox) {
        sat.hitbox.position.copy(pos);
        sat.hitbox.visible = sat.visible;
      }

      // Skip invisible satellites (set scale to 0)
      if (!sat.visible || !sat.mesh.visible) {
        this._matrix.makeScale(0, 0, 0);
        this.instancedMesh.setMatrixAt(i, this._matrix);
        continue;
      }

      // Build transformation matrix
      this._position.copy(pos);
      this._scale.copy(sat.mesh.scale);
      this._matrix.compose(this._position, this._quaternion, this._scale);

      this.instancedMesh.setMatrixAt(i, this._matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Update satellite scale based on camera distance
   */
  updateScales(camera) {
    for (const sat of this.satellites) {
      if (sat.visible && sat.mesh.visible) {
        const dist = camera.position.distanceTo(sat.mesh.position);
        const scale = Math.max(1, Math.log10(dist / 10000));
        sat.mesh.scale.setScalar(scale);
      }
    }
  }

  /**
   * Clear all satellites
   */
  clear() {
    // Remove hitboxes
    for (const hitbox of this.hitboxes) {
      this.scene.remove(hitbox);
    }
    this.hitboxes = [];

    // Remove orbit lines
    for (const sat of this.satellites) {
      if (sat.orbitLine) {
        this.scene.remove(sat.orbitLine);
        sat.orbitLine.geometry.dispose();
        sat.orbitLine.material.dispose();
      }
    }

    this.satellites = [];

    // Reset instanced mesh
    if (this.instancedMesh) {
      const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < this.instancedMesh.count; i++) {
        this.instancedMesh.setMatrixAt(i, zeroMatrix);
      }
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Create an orbit line for a satellite on-demand (for selected satellite only)
   * This avoids computing 360 SGP4 calls per satellite at startup
   * @param {Object} sat - Satellite object
   * @param {Date} simulationTime - Current simulation time (defaults to wall-clock if not provided)
   */
  createOrbitLine(sat, simulationTime = null) {
    // Remove existing orbit line if any
    if (sat.orbitLine) {
      this.scene.remove(sat.orbitLine);
      sat.orbitLine.geometry.dispose();
      sat.orbitLine.material.dispose();
      sat.orbitLine = null;
    }

    if (!sat.satrec) return null;

    // Use simulation time if provided, otherwise use current wall-clock time
    const baseDate = simulationTime || new Date();

    // Store the epoch for this orbit line to detect when refresh is needed
    sat.orbitLineEpoch = baseDate.getTime();

    // Generate orbit points (360 points for full orbit)
    const points = [];
    const periodMs = sat.orbit.period * 60 * 1000; // period in ms

    for (let i = 0; i <= 360; i++) {
      const timeOffset = (i / 360) * periodMs;
      const pointDate = new Date(baseDate.getTime() + timeOffset);

      try {
        const positionAndVelocity = satellite.propagate(sat.satrec, pointDate);
        if (positionAndVelocity.position) {
          const pos = positionAndVelocity.position;
          // Convert TEME to Three.js: swap Y/Z, negate Z
          points.push(new THREE.Vector3(pos.x, pos.z, -pos.y));
        }
      } catch (e) {
        // Skip failed propagation points
      }
    }

    if (points.length < 2) return null;

    // Create geometry and material
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: sat.color,
      transparent: true,
      opacity: 0.6,
      linewidth: 1
    });

    sat.orbitLine = new THREE.Line(geometry, material);
    sat.orbitLine.visible = true;
    this.scene.add(sat.orbitLine);

    return sat.orbitLine;
  }

  /**
   * Update orbit line if simulation time has diverged significantly from when it was created.
   * This keeps the orbit line in sync with the ground track during time warp.
   * @param {Object} sat - Satellite object with orbitLine
   * @param {Date} simulationTime - Current simulation time
   * @param {number} thresholdMs - Time difference threshold to trigger refresh (default: 5 minutes)
   * @returns {boolean} - True if orbit was refreshed
   */
  updateOrbitLineIfNeeded(sat, simulationTime, thresholdMs = 5 * 60 * 1000) {
    if (!sat || !sat.orbitLine || !sat.orbitLineEpoch) return false;

    const currentSimMs = simulationTime.getTime();
    const orbitEpochMs = sat.orbitLineEpoch;
    const timeDrift = Math.abs(currentSimMs - orbitEpochMs);

    // If the orbit line epoch has drifted more than threshold from current sim time, refresh
    if (timeDrift > thresholdMs) {
      this.createOrbitLine(sat, simulationTime);
      return true;
    }

    return false;
  }

  /**
   * Remove orbit line from a satellite
   */
  removeOrbitLine(sat) {
    if (sat.orbitLine) {
      this.scene.remove(sat.orbitLine);
      sat.orbitLine.geometry.dispose();
      sat.orbitLine.material.dispose();
      sat.orbitLine = null;
    }
  }

  /**
   * Dispose all GPU resources
   */
  dispose() {
    this.clear();

    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.dispose();
      this.instancedMesh = null;
    }

    this.geometry.dispose();
    this.material.dispose();
    this.hitboxGeometry.dispose();
    this.hitboxMaterial.dispose();
  }
}

export default SatelliteManager;
