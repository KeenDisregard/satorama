/**
 * Converts degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} - Angle in radians
 */
export function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Converts radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} - Angle in degrees
 */
export function radToDeg(radians) {
  return radians * (180 / Math.PI);
}

/**
 * Converts lat/lon coordinates to 3D position
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {number} radius - Radius of the sphere
 * @returns {Object} - {x, y, z} position
 */
export function latLonToVector3(lat, lon, radius) {
  const phi = degToRad(90 - lat);
  const theta = degToRad(lon + 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return { x, y, z };
}

/**
 * Calculate if a satellite is visible from a ground station
 * @param {Object} stationPos - Ground station position {x, y, z}
 * @param {Object} satellitePos - Satellite position {x, y, z}
 * @param {number} earthRadius - Radius of the Earth
 * @returns {boolean} - True if satellite is visible
 */
export function isSatelliteVisibleFromStation(stationPos, satellitePos, earthRadius) {
  // Check if satellite is visible from ground station (not blocked by Earth)
  // Uses geometric line-of-sight check

  // Vector from station to satellite
  const dx = satellitePos.x - stationPos.x;
  const dy = satellitePos.y - stationPos.y;
  const dz = satellitePos.z - stationPos.z;

  // Distance from station to satellite
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (distance === 0) return false;

  // Ground station normal (points away from Earth center)
  const stationDist = Math.sqrt(stationPos.x * stationPos.x + stationPos.y * stationPos.y + stationPos.z * stationPos.z);
  const nx = stationPos.x / stationDist;
  const ny = stationPos.y / stationDist;
  const nz = stationPos.z / stationDist;

  // Direction to satellite (normalized)
  const sx = dx / distance;
  const sy = dy / distance;
  const sz = dz / distance;

  // Elevation angle: dot product of station normal and direction to satellite
  // If negative, satellite is below the local horizon
  const elevationCos = nx * sx + ny * sy + nz * sz;

  // For visibility, we need elevation > 0 (above horizon)
  // Adding small tolerance for numerical precision
  if (elevationCos < -0.01) return false;

  // Additional check: ensure the ray doesn't pass through Earth
  // For satellites above horizon, this is usually true, but check for edge cases
  // where the satellite is very far and the ray grazes Earth

  // The minimum distance from ray to Earth center occurs at:
  // t = -(station · rayDir) where rayDir is normalized
  const t = -(stationPos.x * sx + stationPos.y * sy + stationPos.z * sz);

  // If t < 0, closest point is behind station (toward satellite), ray is moving away from Earth
  // If t > distance, closest point is beyond satellite
  // Only check for intersection if closest point is between station and satellite
  if (t > 0 && t < distance) {
    const closestX = stationPos.x + t * sx;
    const closestY = stationPos.y + t * sy;
    const closestZ = stationPos.z + t * sz;
    const closestDist = Math.sqrt(closestX * closestX + closestY * closestY + closestZ * closestZ);

    // If closest point is inside Earth, LOS blocked
    if (closestDist < earthRadius * 0.98) return false;
  }

  return true;
}

/**
 * Calculate FPS
 * @param {number} frameCount - Number of frames rendered
 * @param {number} elapsedTime - Time elapsed in milliseconds
 * @returns {number} - Frames per second
 */
export function calculateFPS(frameCount, elapsedTime) {
  return Math.round((frameCount * 1000) / elapsedTime);
}

/**
 * Generate a random color
 * @returns {number} - RGB color in hexadecimal
 */
export function randomColor() {
  return Math.floor(Math.random() * 0xffffff);
}

/**
 * Get satellite type color
 * @param {string} type - Satellite type (LEO, MEO, GEO, HEO)
 * @returns {number} - RGB color in hexadecimal
 */
export function getSatelliteTypeColor(type) {
  switch (type) {
    case 'LEO':
      return 0x00ffff; // Cyan
    case 'MEO':
      return 0xffff00; // Yellow
    case 'GEO':
      return 0xff00ff; // Magenta
    case 'HEO':
      return 0xff0000; // Red
    default:
      return 0xffffff; // White
  }
}
