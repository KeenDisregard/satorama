/**
 * Generates synthetic TLE (Two-Line Element) data for testing
 * This allows visualization with thousands of satellites without needing real TLE data
 */

// Sample TLE data format for reference:
// ISS (ZARYA)
// 1 25544U 98067A   21306.18396740  .00001875  00000-0  42844-4 0  9993
// 2 25544  51.6444 354.6522 0006238 167.8221 327.3999 15.48439540312055

/**
 * Generate synthetic TLE data for the given number of satellites
 * @param {number} count - Number of TLEs to generate
 * @returns {Array} - Array of TLE objects
 */
export function generateTLE(count) {
  const tleData = [];
  
  // Counter for satellite numbers
  let satNum = 10000;
  
  // Generate different types of satellites based on count
  // LEO (60%), MEO (20%), GEO (10%), HEO (10%)
  const leoCount = Math.floor(count * 0.6);
  const meoCount = Math.floor(count * 0.2);
  const geoCount = Math.floor(count * 0.1);
  const heoCount = count - leoCount - meoCount - geoCount;
  
  // Generate LEO satellites
  for (let i = 0; i < leoCount; i++) {
    tleData.push(generateLEOSatellite(satNum++));
  }
  
  // Generate MEO satellites
  for (let i = 0; i < meoCount; i++) {
    tleData.push(generateMEOSatellite(satNum++));
  }
  
  // Generate GEO satellites
  for (let i = 0; i < geoCount; i++) {
    tleData.push(generateGEOSatellite(satNum++));
  }
  
  // Generate HEO satellites
  for (let i = 0; i < heoCount; i++) {
    tleData.push(generateHEOSatellite(satNum++));
  }
  
  return tleData;
}

/**
 * Generate a LEO (Low Earth Orbit) satellite TLE
 * Altitude: ~160-2000km, Period: ~90 minutes
 */
function generateLEOSatellite(satNum) {
  // Random inclination (0-90 degrees)
  const inclination = Math.random() * 90;
  
  // Random altitude between 160-2000km
  const altitude = 160 + Math.random() * 1840;
  
  // Calculate mean motion from altitude (revolutions per day)
  // Formula approximation: n = 1440 / (2π * sqrt((RE + h)^3 / μ))
  // where RE = 6378.137 (Earth radius), h = altitude, μ = 398600.4418 (Earth gravitational parameter)
  const earthRadius = 6378.137;
  const mu = 398600.4418;
  const semiMajorAxis = earthRadius + altitude;
  const meanMotion = 1440 / (2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu));
  
  // Random eccentricity (LEO usually has e < 0.1)
  const eccentricity = Math.random() * 0.1;
  
  // Random RAAN (0-360 degrees)
  const raan = Math.random() * 360;
  
  // Random argument of perigee (0-360 degrees)
  const argPerigee = Math.random() * 360;
  
  // Random mean anomaly (0-360 degrees)
  const meanAnomaly = Math.random() * 360;
  
  return createTLEObject(`LEO-${satNum}`, satNum, inclination, raan, eccentricity, argPerigee, meanAnomaly, meanMotion);
}

/**
 * Generate a MEO (Medium Earth Orbit) satellite TLE
 * Altitude: ~2000-35786km, Period: ~2-24 hours
 */
function generateMEOSatellite(satNum) {
  // Random inclination (0-90 degrees, with bias toward specific inclinations used for navigation)
  const inclinations = [0, 45, 55, 64.8]; // Common inclinations for MEO satellites
  const inclination = Math.random() < 0.7 ? 
    inclinations[Math.floor(Math.random() * inclinations.length)] : 
    Math.random() * 90;
  
  // Random altitude between 2000-35786km (MEO range)
  const altitude = 2000 + Math.random() * 33786;
  
  // Calculate mean motion from altitude
  const earthRadius = 6378.137;
  const mu = 398600.4418;
  const semiMajorAxis = earthRadius + altitude;
  const meanMotion = 1440 / (2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu));
  
  // Random eccentricity (MEO usually has e < 0.1)
  const eccentricity = Math.random() * 0.05;
  
  // Random RAAN (0-360 degrees)
  const raan = Math.random() * 360;
  
  // Random argument of perigee (0-360 degrees)
  const argPerigee = Math.random() * 360;
  
  // Random mean anomaly (0-360 degrees)
  const meanAnomaly = Math.random() * 360;
  
  return createTLEObject(`MEO-${satNum}`, satNum, inclination, raan, eccentricity, argPerigee, meanAnomaly, meanMotion);
}

/**
 * Generate a GEO (Geostationary Orbit) satellite TLE
 * Altitude: ~35786km, Period: 24 hours, Inclination: ~0 degrees
 */
function generateGEOSatellite(satNum) {
  // GEO has inclination close to 0 (with slight variations due to perturbations)
  const inclination = Math.random() * 1; // 0-1 degree variation
  
  // GEO altitude is fixed at approximately 35786km
  const altitude = 35786;
  
  // Calculate mean motion (should be close to 1 revolution per day)
  const earthRadius = 6378.137;
  const mu = 398600.4418;
  const semiMajorAxis = earthRadius + altitude;
  const meanMotion = 1.0027; // Slightly over 1 revolution per day
  
  // GEO has eccentricity close to 0
  const eccentricity = Math.random() * 0.01;
  
  // Random longitude (represented as RAAN + Arg of Perigee)
  const raan = Math.random() * 360;
  const argPerigee = Math.random() * 360;
  
  // Random mean anomaly (0-360 degrees)
  const meanAnomaly = Math.random() * 360;
  
  return createTLEObject(`GEO-${satNum}`, satNum, inclination, raan, eccentricity, argPerigee, meanAnomaly, meanMotion);
}

/**
 * Generate a HEO (Highly Elliptical Orbit) satellite TLE
 * Eccentricity: 0.5-0.9, Period: variable
 */
function generateHEOSatellite(satNum) {
  // HEO often has high inclinations
  const inclination = 63.4 + (Math.random() - 0.5) * 10; // Around 63.4° (Molniya orbits)
  
  // High eccentricity
  const eccentricity = 0.5 + Math.random() * 0.4; // 0.5-0.9
  
  // Perigee altitude (varies, but typically 500-1000km)
  const perigeeAltitude = 500 + Math.random() * 500;
  
  // Apogee altitude (much higher, typically 30000-40000km)
  const apogeeAltitude = 30000 + Math.random() * 10000;
  
  // Calculate semi-major axis
  const earthRadius = 6378.137;
  const semiMajorAxis = ((earthRadius + perigeeAltitude) + (earthRadius + apogeeAltitude)) / 2;
  
  // Calculate mean motion from semi-major axis
  const mu = 398600.4418;
  const meanMotion = 1440 / (2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu));
  
  // For Molniya orbits, argument of perigee is typically around 270 degrees
  const argPerigee = 270 + (Math.random() - 0.5) * 20;
  
  // Random RAAN (0-360 degrees)
  const raan = Math.random() * 360;
  
  // Random mean anomaly (0-360 degrees)
  const meanAnomaly = Math.random() * 360;
  
  return createTLEObject(`HEO-${satNum}`, satNum, inclination, raan, eccentricity, argPerigee, meanAnomaly, meanMotion);
}

/**
 * Create a TLE object with the given parameters
 */
function createTLEObject(name, satNum, inclination, raan, eccentricity, argPerigee, meanAnomaly, meanMotion) {
  // Format values for TLE
  const satNumStr = satNum.toString().padStart(5, '0');
  const inclinationStr = inclination.toFixed(4).padStart(8, ' ');
  const raanStr = raan.toFixed(4).padStart(8, ' ');
  const eccentricityStr = ('0' + eccentricity.toFixed(7)).substring(0, 8);
  const argPerigeeStr = argPerigee.toFixed(4).padStart(8, ' ');
  const meanAnomalyStr = meanAnomaly.toFixed(4).padStart(8, ' ');
  const meanMotionStr = meanMotion.toFixed(8).padStart(11, ' ');
  
  // International designator (year and launch number)
  const year = (new Date().getFullYear() % 100).toString().padStart(2, '0');
  const launchNum = Math.floor(Math.random() * 999).toString().padStart(3, '0');
  const piece = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const intlDesignator = `${year}${launchNum}${piece}`;
  
  // Epoch (year and day of year)
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now - startOfYear;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const epochYear = (now.getFullYear() % 100).toString().padStart(2, '0');
  const epochDay = (dayOfYear + now.getHours()/24 + now.getMinutes()/(24*60)).toFixed(8).padStart(12, ' ');
  const epoch = epochYear + epochDay;
  
  // Generate TLE lines
  const tle1 = `1 ${satNumStr}U ${intlDesignator} ${epoch} .00000000  00000-0  00000-0 0  9990`;
  const tle2 = `2 ${satNumStr} ${inclinationStr} ${raanStr} ${eccentricityStr} ${argPerigeeStr} ${meanAnomalyStr} ${meanMotionStr}00001`;
  
  return {
    name: name,
    tle1: tle1,
    tle2: tle2
  };
}
