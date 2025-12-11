import * as THREE from 'three';
import * as satellite from 'satellite.js';

/**
 * GroundTrack - Projects satellite path onto Earth's surface
 * Shows past track (solid line) and future track (dashed line)
 * Handles dateline crossing by breaking into segments
 */
class GroundTrack {
  constructor(scene, earthRadius, earthMesh = null) {
    this.scene = scene;
    this.earthRadius = earthRadius;
    this.earthMesh = earthMesh; // Reference to Earth mesh for rotation
    this.target = null;
    this.visible = false; // Default OFF to match UI toggle state

    // Track groups
    this.groundTrack = new THREE.Group(); // Past track
    this.futureTrack = new THREE.Group(); // Future track
    this.positionMarker = null;

    // Track appearance
    this.pastColor = 0x00ff00;
    this.futureColor = 0x00ff00;
    this.trackHeight = 50; // Height above Earth surface

    // Throttling - SGP4 is expensive, only recalculate periodically
    this.lastUpdateTime = 0;
    this.updateInterval = 500; // Only recalculate every 500ms
    this.lastSimTime = 0; // Track sim time to detect jumps

    // Add groups as children of Earth mesh so they rotate with it
    // If no earthMesh provided, fall back to adding to scene
    if (this.earthMesh) {
      this.earthMesh.add(this.groundTrack);
      this.earthMesh.add(this.futureTrack);
    } else {
      this.scene.add(this.groundTrack);
      this.scene.add(this.futureTrack);
    }
  }

  /**
   * Set the satellite to track
   * @param {Object} sat - Satellite object to track
   */
  setTarget(sat) {
    this.clearTrack();
    this.target = sat;

    if (sat) {
      this.createPositionMarker();
    }
  }

  /**
   * Create a marker for current ground position
   */
  createPositionMarker() {
    if (this.positionMarker) {
      this.scene.remove(this.positionMarker);
    }

    const geometry = new THREE.SphereGeometry(30, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8
    });

    this.positionMarker = new THREE.Mesh(geometry, material);
    this.positionMarker.visible = this.visible;
    this.scene.add(this.positionMarker);
  }

  /**
   * Convert satellite position to ground position (lat/lon projected onto Earth surface)
   * @param {Object} positionEci - ECI position {x, y, z}
   * @param {Date} date - Current date for GMST calculation
   * @returns {Object} - {lat, lon} in degrees
   */
  eciToLatLon(positionEci, date) {
    const gmst = satellite.gstime(date);
    const geodetic = satellite.eciToGeodetic(positionEci, gmst);

    return {
      lat: satellite.degreesLat(geodetic.latitude),
      lon: satellite.degreesLong(geodetic.longitude)
    };
  }

  /**
   * Convert lat/lon to 3D position on Earth surface
   * @param {number} lat - Latitude in degrees
   * @param {number} lon - Longitude in degrees
   * @returns {THREE.Vector3}
   */
  latLonToVector3(lat, lon) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const radius = this.earthRadius + this.trackHeight;

    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
  }

  /**
   * Update the ground track
   * @param {Date} simulationTime - Current simulation time
   */
  update(simulationTime) {
    if (!this.target || !this.target.satrec) return;

    // Throttle updates - ground track doesn't need 60fps recalculation
    const now = performance.now();
    const simTimeMs = simulationTime.getTime();
    const simTimeDelta = Math.abs(simTimeMs - this.lastSimTime);

    // Only update if: enough real time passed OR large sim time jump (time warp/reset)
    const needsUpdate = (now - this.lastUpdateTime >= this.updateInterval) ||
      (simTimeDelta > 60000); // >1 min sim time jump

    if (!needsUpdate) {
      // Just update position marker (cheap)
      this.updateMarkerOnly(simulationTime);
      return;
    }

    this.lastUpdateTime = now;
    this.lastSimTime = simTimeMs;

    // Clear existing tracks
    this.clearTrackMeshes();

    const pastPoints = [];
    const futurePoints = [];

    // Calculate past track using adaptive sampling
    const pastPoints45 = this.sampleTrackAdaptive(simulationTime, -45 * 60 * 1000, 0);
    pastPoints.push(...pastPoints45);

    // Calculate future track using adaptive sampling
    const futurePoints45 = this.sampleTrackAdaptive(simulationTime, 0, 45 * 60 * 1000);
    futurePoints.push(...futurePoints45.slice(1)); // Skip duplicate at t=0

    // Create track meshes (handling dateline crossings)
    this.createTrackSegments(pastPoints, this.groundTrack, this.pastColor, false);
    this.createTrackSegments(futurePoints, this.futureTrack, this.futureColor, true);

    // Update position marker
    if (this.positionMarker && pastPoints.length > 0) {
      const currentPos = pastPoints[pastPoints.length - 1];
      this.positionMarker.position.copy(currentPos.position);
    }
  }

  /**
   * Quick update for just the position marker (no SGP4)
   */
  updateMarkerOnly(simulationTime) {
    if (!this.positionMarker || !this.target) return;

    // Use satellite's current mesh position projected to ground
    const satPos = this.target.mesh.position;
    if (!satPos) return;

    // Quick projection: normalize to earth surface
    const dist = satPos.length();
    if (dist > 0) {
      const scale = (this.earthRadius + this.trackHeight) / dist;
      this.positionMarker.position.set(
        satPos.x * scale,
        satPos.y * scale,
        satPos.z * scale
      );
    }
  }

  /**
   * Get ground position for a given time
   * @param {Date} time - Time to calculate position for
   * @returns {Object} - {position: Vector3, lat, lon} or null
   */
  getGroundPoint(time) {
    try {
      const positionAndVelocity = satellite.propagate(this.target.satrec, time);
      if (!positionAndVelocity.position) return null;

      const latLon = this.eciToLatLon(positionAndVelocity.position, time);
      const position = this.latLonToVector3(latLon.lat, latLon.lon);

      return { position, lat: latLon.lat, lon: latLon.lon };
    } catch (e) {
      return null;
    }
  }

  /**
   * Get ground position with velocity for adaptive sampling
   * @param {Date} time - Time to calculate position for
   * @returns {Object} - {position, lat, lon, velocity} or null
   */
  getGroundPointWithVelocity(time) {
    try {
      const positionAndVelocity = satellite.propagate(this.target.satrec, time);
      if (!positionAndVelocity.position || !positionAndVelocity.velocity) return null;

      const latLon = this.eciToLatLon(positionAndVelocity.position, time);
      const position = this.latLonToVector3(latLon.lat, latLon.lon);

      // Calculate velocity magnitude (km/s)
      const vel = positionAndVelocity.velocity;
      const velocity = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

      return { position, lat: latLon.lat, lon: latLon.lon, velocity };
    } catch (e) {
      return null;
    }
  }

  /**
   * Sample track with adaptive time steps based on orbital velocity
   * More samples at high velocity (perigee), fewer at low velocity (apogee)
   * @param {Date} baseTime - Reference time
   * @param {number} startOffsetMs - Start offset from baseTime in ms
   * @param {number} endOffsetMs - End offset from baseTime in ms
   * @returns {Array} - Array of {position, lat, lon} points
   */
  sampleTrackAdaptive(baseTime, startOffsetMs, endOffsetMs) {
    const points = [];

    // Target arc length between samples (km) - balances detail vs. performance
    const targetArcLength = 100; // km

    // Min/max time step bounds
    const minDtMs = 10 * 1000;   // 10 seconds minimum
    const maxDtMs = 120 * 1000;  // 2 minutes maximum

    // Maximum points to prevent runaway
    const maxPoints = 200;

    const direction = startOffsetMs < endOffsetMs ? 1 : -1;
    let currentOffsetMs = startOffsetMs;

    while ((direction > 0 && currentOffsetMs <= endOffsetMs) ||
      (direction < 0 && currentOffsetMs >= endOffsetMs)) {

      if (points.length >= maxPoints) break;

      const time = new Date(baseTime.getTime() + currentOffsetMs);
      const point = this.getGroundPointWithVelocity(time);

      if (point) {
        points.push({ position: point.position, lat: point.lat, lon: point.lon });

        // Calculate adaptive time step based on velocity
        // dt = targetArcLength / velocity
        // velocity is in km/s, we want dt in ms
        const velocity = point.velocity || 7.8; // Default to LEO velocity if unavailable
        let dtMs = (targetArcLength / velocity) * 1000;

        // Clamp to bounds
        dtMs = Math.max(minDtMs, Math.min(maxDtMs, dtMs));

        currentOffsetMs += direction * dtMs;
      } else {
        // If propagation failed, skip ahead with default step
        currentOffsetMs += direction * 60 * 1000;
      }
    }

    // Ensure we have the endpoint
    if (points.length > 0) {
      const endTime = new Date(baseTime.getTime() + endOffsetMs);
      const endPoint = this.getGroundPoint(endTime);
      if (endPoint) {
        const lastPoint = points[points.length - 1];
        // Only add if significantly different from last point
        if (Math.abs(lastPoint.lon - endPoint.lon) > 0.5 ||
          Math.abs(lastPoint.lat - endPoint.lat) > 0.5) {
          points.push(endPoint);
        }
      }
    }

    return direction > 0 ? points : points.reverse();
  }

  /**
   * Create track line segments, breaking at dateline crossings
   * @param {Array} points - Array of {position, lat, lon} objects
   * @param {THREE.Group} group - Group to add lines to
   * @param {number} color - Line color
   * @param {boolean} dashed - Whether to use dashed lines
   */
  createTrackSegments(points, group, color, dashed) {
    if (points.length < 2) return;

    let segment = [];

    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      segment.push(current.position);

      // Check for dateline crossing (large longitude jump)
      if (i < points.length - 1) {
        const next = points[i + 1];
        const lonDiff = Math.abs(current.lon - next.lon);

        if (lonDiff > 180) {
          // Dateline crossing - end current segment and start new one
          this.addLineToGroup(segment, group, color, dashed);
          segment = [];
        }
      }
    }

    // Add final segment
    if (segment.length >= 2) {
      this.addLineToGroup(segment, group, color, dashed);
    }
  }

  /**
   * Add a line segment to a group
   * @param {Array} positions - Array of Vector3 positions
   * @param {THREE.Group} group - Group to add line to
   * @param {number} color - Line color
   * @param {boolean} dashed - Whether to use dashed lines
   */
  addLineToGroup(positions, group, color, dashed) {
    const geometry = new THREE.BufferGeometry().setFromPoints(positions);

    let material;
    if (dashed) {
      material = new THREE.LineDashedMaterial({
        color: color,
        transparent: true,
        opacity: 0.5,
        dashSize: 100,
        gapSize: 50
      });
    } else {
      material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.7
      });
    }

    const line = new THREE.Line(geometry, material);

    if (dashed) {
      line.computeLineDistances();
    }

    line.visible = this.visible;
    group.add(line);
  }

  /**
   * Clear track meshes (dispose geometries properly)
   */
  clearTrackMeshes() {
    // Traverse and dispose ground track children
    this.groundTrack.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    this.groundTrack.clear();

    // Traverse and dispose future track children
    this.futureTrack.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    this.futureTrack.clear();
  }

  /**
   * Clear the entire track
   */
  clearTrack() {
    this.target = null;
    this.clearTrackMeshes();

    if (this.positionMarker) {
      this.scene.remove(this.positionMarker);
      this.positionMarker = null;
    }
  }

  /**
   * Toggle track visibility
   * @param {boolean} visible - Whether track should be visible
   */
  toggleVisibility(visible) {
    this.visible = visible;
    this.groundTrack.visible = visible;
    this.futureTrack.visible = visible;

    if (this.positionMarker) {
      this.positionMarker.visible = visible;
    }
  }
}

export default GroundTrack;
