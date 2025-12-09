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
  // Direction from ground station to satellite
  const dx = satellitePos.x - stationPos.x;
  const dy = satellitePos.y - stationPos.y;
  const dz = satellitePos.z - stationPos.z;
  
  // Distance from ground station to satellite
  const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
  
  // Direction from earth center to ground station
  const stationDirX = stationPos.x;
  const stationDirY = stationPos.y;
  const stationDirZ = stationPos.z;
  const stationDist = Math.sqrt(stationDirX*stationDirX + stationDirY*stationDirY + stationDirZ*stationDirZ);
  
  // Normalized direction from earth center to ground station
  const stationNormX = stationDirX / stationDist;
  const stationNormY = stationDirY / stationDist;
  const stationNormZ = stationDirZ / stationDist;
  
  // Direction from earth center to satellite
  const satDirX = satellitePos.x;
  const satDirY = satellitePos.y;
  const satDirZ = satellitePos.z;
  const satDist = Math.sqrt(satDirX*satDirX + satDirY*satDirY + satDirZ*satDirZ);
  
  // Angle between ground station and satellite from earth center
  const dotProduct = stationNormX * (satDirX / satDist) + 
                     stationNormY * (satDirY / satDist) + 
                     stationNormZ * (satDirZ / satDist);
  
  // Angle in radians
  const angle = Math.acos(dotProduct);
  
  // Maximum angle for visibility (90 degrees plus angular radius of earth)
  const maxAngle = Math.PI / 2 + Math.asin(earthRadius / satDist);
  
  return angle <= maxAngle;
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
