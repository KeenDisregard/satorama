import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { getSatelliteTypeColor } from '../utils.js';

// Shared hitbox geometry for all satellites (reduces memory)
const SHARED_HITBOX_GEOMETRY = new THREE.SphereGeometry(200, 4, 4);
const SHARED_HITBOX_MATERIAL = new THREE.MeshBasicMaterial({ visible: false });

class Satellite {
  constructor(tleData) {
    // Store TLE data
    this.tleData = tleData;
    
    // Parse satellite.js record
    this.satrec = satellite.twoline2satrec(tleData.tle1, tleData.tle2);
    
    // Set satellite type
    this.type = this.determineSatelliteType();
    
    // Set color based on type
    this.color = getSatelliteTypeColor(this.type);
    
    // Calculate orbital parameters
    this.calculateOrbitalParameters();
    
    // Create satellite object
    this.createSatellite();
    
    // Create orbit line
    this.createOrbitLine();
  }
  
  determineSatelliteType() {
    // Calculate semi-major axis (km)
    const mm = this.satrec.no; // mean motion (rad/min)
    const mmRadPerSec = mm / 60; // Convert to rad/s for formula consistency
    const earthRadius = 6378.137;
    const mu = 398600.4418; // km³/s²
    const a = Math.pow(mu / (mmRadPerSec * mmRadPerSec), 1/3);
    
    // Calculate period in minutes
    this.period = (2 * Math.PI) / mm;
    
    // Get eccentricity
    const e = this.satrec.ecco;
    
    // Classification thresholds
    const GEO_ALTITUDE = 35786; // km
    const GEO_SMA = earthRadius + GEO_ALTITUDE; // ~42164 km
    const LEO_MAX_ALTITUDE = 2000; // km
    const LEO_MAX_SMA = earthRadius + LEO_MAX_ALTITUDE; // ~8378 km
    
    // HEO first: defined by high eccentricity (elliptical orbit)
    if (e > 0.25) {
      return 'HEO'; // Highly Elliptical Orbit
    }
    
    // GEO: circular orbit at geostationary altitude
    if (Math.abs(a - GEO_SMA) < 1000 && e < 0.01) {
      return 'GEO'; // Geostationary Orbit
    }
    
    // LEO: below 2000 km altitude
    if (a < LEO_MAX_SMA) {
      return 'LEO'; // Low Earth Orbit
    }
    
    // MEO: between LEO and GEO (2000 - 35786 km)
    return 'MEO'; // Medium Earth Orbit
  }
  
  calculateOrbitalParameters() {
    // Store orbital parameters
    this.orbit = {
      period: this.period,
      inclination: this.satrec.inclo * 180 / Math.PI,
      eccentricity: this.satrec.ecco,
      altitude: this.calculateAltitude()
    };
  }
  
  calculateAltitude() {
    // Calculate position at current time
    const now = new Date();
    const positionAndVelocity = satellite.propagate(this.satrec, now);
    
    if (positionAndVelocity.position) {
      const position = positionAndVelocity.position;
      
      // Calculate distance from Earth center (in km)
      const distance = Math.sqrt(
        position.x * position.x +
        position.y * position.y +
        position.z * position.z
      );
      
      // Subtract Earth radius to get altitude
      return distance - 6371;
    }
    
    return 0;
  }
  
  createSatellite() {
    // Size based on satellite type - larger for visibility without dynamic scaling
    let size;
    switch (this.type) {
      case 'LEO': size = 150; break;
      case 'MEO': size = 200; break;
      case 'GEO': size = 250; break;
      case 'HEO': size = 200; break;
      default: size = 150;
    }
    
    // Use simplified geometry (4 segments instead of 8) for performance
    let geometry;
    if (this.type === 'GEO') {
      geometry = new THREE.BoxGeometry(size, size, size);
    } else if (this.type === 'HEO') {
      geometry = new THREE.ConeGeometry(size/2, size, 4);
    } else {
      geometry = new THREE.SphereGeometry(size/2, 4, 4);
    }
    
    // Create material
    const material = new THREE.MeshPhongMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 0.5,
      shininess: 100
    });
    
    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    
    // Create invisible hitbox mesh (shared geometry, larger for easier clicking)
    this.hitbox = new THREE.Mesh(SHARED_HITBOX_GEOMETRY, SHARED_HITBOX_MATERIAL);
    
    // Add satellite reference to both mesh and hitbox for raycasting
    const userData = {
      name: this.tleData.name,
      type: this.type,
      satellite: this
    };
    this.mesh.userData = userData;
    this.hitbox.userData = userData;
  }
  
  createOrbitLine() {
    // Create orbit line geometry
    const geometry = new THREE.BufferGeometry();
    
    // Generate orbit points (360 points for full orbit)
    const points = [];
    const date = new Date();
    
    for (let i = 0; i < 360; i++) {
      // Calculate position at different times
      const timeOffset = (i / 360) * this.period * 60 * 1000; // Convert to milliseconds
      const pointDate = new Date(date.getTime() + timeOffset);
      
      const positionAndVelocity = satellite.propagate(this.satrec, pointDate);
      if (positionAndVelocity.position) {
        const pos = positionAndVelocity.position;
        // Convert TEME to Three.js: swap Y/Z, negate Z to preserve handedness
        points.push(new THREE.Vector3(pos.x, pos.z, -pos.y));
      }
    }
    
    // Set geometry vertices
    geometry.setFromPoints(points);
    
    // Create material
    const material = new THREE.LineBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.5,
      linewidth: 1
    });
    
    // Create line
    this.orbitLine = new THREE.Line(geometry, material);
    this.orbitLine.visible = false; // Initially hidden
  }
  
  update(date, showOrbit) {
    // Update satellite position based on time
    const positionAndVelocity = satellite.propagate(this.satrec, date);
    
    if (positionAndVelocity.position) {
      const pos = positionAndVelocity.position;
      
      // Convert TEME to Three.js: swap Y/Z, negate Z to preserve handedness
      this.mesh.position.set(pos.x, pos.z, -pos.y);
      this.hitbox.position.copy(this.mesh.position);
      
      // Update orbit visibility
      this.orbitLine.visible = showOrbit;
    }
  }
  
  add(scene) {
    // Add satellite, hitbox, and orbit to scene
    scene.add(this.mesh);
    scene.add(this.hitbox);
    scene.add(this.orbitLine);
  }
  
  remove(scene) {
    // Remove satellite, hitbox, and orbit from scene
    scene.remove(this.mesh);
    scene.remove(this.hitbox);
    scene.remove(this.orbitLine);
    
    // Dispose GPU resources to prevent VRAM leak
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    if (this.orbitLine) {
      this.orbitLine.geometry.dispose();
      this.orbitLine.material.dispose();
    }
    // Note: hitbox uses shared geometry/material, don't dispose
  }
  
  toggleVisibility(visible) {
    // Toggle satellite visibility
    this.mesh.visible = visible;
    // Also hide orbit if satellite is hidden
    if (!visible) {
      this.orbitLine.visible = false;
    }
  }
  
  toggleOrbit(visible) {
    // Toggle orbit visibility
    this.orbitLine.visible = visible;
  }
}

export default Satellite;
