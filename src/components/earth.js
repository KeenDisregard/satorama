import * as THREE from 'three';

class Earth {
  constructor() {
    // Earth parameters
    this.radius = 6371; // Earth radius in km

    // Physics-based rotation speed (radians per second)
    // Earth's sidereal rotation period: 23h 56m 4s = 86164.0905 seconds
    // Angular velocity: 2π / 86164.0905 = 7.2921159 × 10^-5 rad/s
    this.rotationSpeed = 7.2921159e-5; // radians per second

    // Create Earth object
    this.createEarth();

    // Track rotation angle
    this.rotationAngle = 0;
  }

  /**
   * Set Earth rotation to match real-world orientation for a given time
   * Uses Greenwich Mean Sidereal Time (GMST) calculation
   * @param {Date} date - The simulation time to sync to
   */
  setRotationFromTime(date) {
    const gmst = this.calculateGMST(date);
    // GMST is in radians, represents the angle of the prime meridian from vernal equinox
    // Set Earth rotation so Greenwich meridian faces correct direction
    this.mesh.rotation.y = gmst;
    this.rotationAngle = gmst;
  }

  /**
   * Calculate Greenwich Mean Sidereal Time in radians
   * Based on IAU formula for GMST
   * @param {Date} date - UTC date/time
   * @returns {number} GMST in radians
   */
  calculateGMST(date) {
    // Julian date calculation
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const second = date.getUTCSeconds() + date.getUTCMilliseconds() / 1000;

    // Convert to Julian Date
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;

    const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y +
      Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    const jd = jdn + (hour - 12) / 24 + minute / 1440 + second / 86400;

    // Julian centuries since J2000.0
    const T = (jd - 2451545.0) / 36525;

    // GMST in degrees (IAU 1982 formula)
    let gmstDeg = 280.46061837 +
      360.98564736629 * (jd - 2451545.0) +
      0.000387933 * T * T -
      T * T * T / 38710000;

    // Normalize to 0-360
    gmstDeg = gmstDeg % 360;
    if (gmstDeg < 0) gmstDeg += 360;

    // Convert to radians
    return gmstDeg * Math.PI / 180;
  }

  createEarth() {
    // Create Earth geometry
    const geometry = new THREE.SphereGeometry(this.radius, 64, 64);

    // Use Vite's base URL for correct path resolution on GitHub Pages
    const base = import.meta.env.BASE_URL || '/';

    // Create material with textures
    const material = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load(`${base}assets/textures/earth-blue-marble.jpg`),
      bumpMap: new THREE.TextureLoader().load(`${base}assets/textures/earth-topology.png`),
      bumpScale: 100,
      specularMap: new THREE.TextureLoader().load(`${base}assets/textures/earth-water.png`),
      specular: new THREE.Color(0x333333)
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
  }

  rotate(deltaTimeSeconds = 1 / 60) {
    // Calculate rotation angle based on actual time delta
    // This makes Earth rotation physics-based and independent of frame rate
    const rotationDelta = this.rotationSpeed * deltaTimeSeconds;

    // Rotate Earth mesh around Y axis
    this.mesh.rotation.y += rotationDelta;
    this.rotationAngle += rotationDelta;
  }

  // Get Earth mesh for ground station rotation calculations
  getMesh() {
    return this.mesh;
  }

  // Get current rotation angle
  getRotationAngle() {
    return this.rotationAngle;
  }
}

export default Earth;
