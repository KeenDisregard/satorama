/**
 * SGP4 Web Worker
 * Runs satellite propagation off the main thread at a fixed timestep.
 * Sends position data back to main thread for interpolation.
 */

import * as satellite from 'satellite.js';

// Satellite records (parsed TLE data)
let satellites = [];
let satrecs = [];

// Position and velocity buffers (working buffers, never transferred)
let positions = null;   // Float32Array [x1, y1, z1, x2, y2, z2, ...]
let velocities = null;  // Float32Array [vx1, vy1, vz1, vx2, vy2, vz2, ...]

// Double-buffered transfer buffers to avoid per-tick allocation
// Transferable ArrayBuffers become "neutered" after postMessage, so we
// pre-allocate two sets and alternate between them.
let transferBufferA = { positions: null, velocities: null };
let transferBufferB = { positions: null, velocities: null };
let useBufferA = true;

// Timing - adaptive based on time multiplier
const BASE_PHYSICS_INTERVAL = 100; // ms at 1x speed
const MIN_PHYSICS_INTERVAL = 16;   // ~60 updates/sec max
const MAX_PHYSICS_INTERVAL = 200;  // 5 updates/sec min
let currentPhysicsInterval = BASE_PHYSICS_INTERVAL;
let physicsTimer = null;
let lastPhysicsTime = 0;
let simulationTime = new Date();
let timeMultiplier = 1;
let isPaused = false;

/**
 * Initialize satellites from TLE data
 */
function initSatellites(tleDataArray) {
  satellites = tleDataArray;
  satrecs = [];

  for (const tle of tleDataArray) {
    try {
      const satrec = satellite.twoline2satrec(tle.tle1, tle.tle2);
      satrecs.push({
        satrec,
        name: tle.name,
        valid: true
      });
    } catch (e) {
      satrecs.push({
        satrec: null,
        name: tle.name,
        valid: false
      });
    }
  }

  // Allocate buffers (3 floats per satellite: x, y, z and vx, vy, vz)
  const bufferSize = satrecs.length * 3;
  positions = new Float32Array(bufferSize);
  velocities = new Float32Array(bufferSize);

  // Allocate double-buffered transfer buffers
  transferBufferA = {
    positions: new Float32Array(bufferSize),
    velocities: new Float32Array(bufferSize)
  };
  transferBufferB = {
    positions: new Float32Array(bufferSize),
    velocities: new Float32Array(bufferSize)
  };
  useBufferA = true;

  // Initial propagation
  propagateAll(simulationTime);

  self.postMessage({
    type: 'initialized',
    count: satrecs.length
  });
}

/**
 * Add a single satellite to the existing set
 */
function addSatellite(tleData, expectedIndex) {
  try {
    const satrec = satellite.twoline2satrec(tleData.tle1, tleData.tle2);
    satrecs.push({
      satrec,
      name: tleData.name,
      valid: true
    });
    satellites.push(tleData);
  } catch (e) {
    satrecs.push({
      satrec: null,
      name: tleData.name,
      valid: false
    });
    satellites.push(tleData);
  }

  // Expand position/velocity buffers
  const newBufferSize = satrecs.length * 3;
  const newPositions = new Float32Array(newBufferSize);
  const newVelocities = new Float32Array(newBufferSize);

  // Copy existing data
  if (positions) {
    newPositions.set(positions);
  }
  if (velocities) {
    newVelocities.set(velocities);
  }

  positions = newPositions;
  velocities = newVelocities;

  // Resize transfer buffers to match (they'll be reallocated on next send if neutered)
  transferBufferA = {
    positions: new Float32Array(newBufferSize),
    velocities: new Float32Array(newBufferSize)
  };
  transferBufferB = {
    positions: new Float32Array(newBufferSize),
    velocities: new Float32Array(newBufferSize)
  };

  // Propagate the new satellite immediately
  const idx = satrecs.length - 1;
  const { satrec: newSatrec, valid } = satrecs[idx];

  if (valid && newSatrec) {
    try {
      const positionAndVelocity = satellite.propagate(newSatrec, simulationTime);
      if (positionAndVelocity.position && positionAndVelocity.velocity) {
        const pos = positionAndVelocity.position;
        const vel = positionAndVelocity.velocity;
        positions[idx * 3] = pos.x;
        positions[idx * 3 + 1] = pos.y;
        positions[idx * 3 + 2] = pos.z;
        velocities[idx * 3] = vel.x;
        velocities[idx * 3 + 1] = vel.y;
        velocities[idx * 3 + 2] = vel.z;
      }
    } catch (e) {
      // Propagation failed
    }
  }

  self.postMessage({
    type: 'satelliteAdded',
    index: idx,
    name: tleData.name
  });
}

/**
 * Propagate all satellites to the given time
 */
function propagateAll(date) {
  for (let i = 0; i < satrecs.length; i++) {
    const { satrec, valid } = satrecs[i];

    if (!valid || !satrec) {
      // Invalid satellite - set to origin (filtered by main thread)
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      continue;
    }

    try {
      const positionAndVelocity = satellite.propagate(satrec, date);

      if (positionAndVelocity.position && positionAndVelocity.velocity) {
        const pos = positionAndVelocity.position;
        const vel = positionAndVelocity.velocity;
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;
        velocities[i * 3] = vel.x;
        velocities[i * 3 + 1] = vel.y;
        velocities[i * 3 + 2] = vel.z;
      }
    } catch (e) {
      // Propagation failed - keep previous position
    }
  }
}

/**
 * Physics update tick - runs at fixed interval
 */
function physicsTick() {
  if (isPaused) return;

  // Advance simulation time
  const now = performance.now();
  const realDelta = now - lastPhysicsTime;
  lastPhysicsTime = now;

  // Scale delta by time multiplier
  const simDelta = realDelta * timeMultiplier;
  simulationTime = new Date(simulationTime.getTime() + simDelta);

  // Propagate to new time
  propagateAll(simulationTime);

  // Send positions and velocities via pre-allocated double buffers
  sendPositionUpdate();
}

/**
 * Calculate physics interval based on time multiplier
 * Higher multiplier = more frequent updates for smooth motion
 */
function calculatePhysicsInterval() {
  const absMultiplier = Math.abs(timeMultiplier);
  if (absMultiplier <= 1) {
    return BASE_PHYSICS_INTERVAL;
  }
  // Scale down interval for higher multipliers
  // At 10x: 100/10 = 10ms -> clamped to 16ms
  // At 100x: 100/100 = 1ms -> clamped to 16ms  
  // At 1000x: same, 16ms (60 updates/sec)
  const interval = BASE_PHYSICS_INTERVAL / Math.sqrt(absMultiplier);
  return Math.max(MIN_PHYSICS_INTERVAL, Math.min(MAX_PHYSICS_INTERVAL, interval));
}

/**
 * Start the physics loop
 */
function startPhysics() {
  if (physicsTimer) return;

  currentPhysicsInterval = calculatePhysicsInterval();
  lastPhysicsTime = performance.now();
  physicsTimer = setInterval(physicsTick, currentPhysicsInterval);

  // Notify main thread of current interval
  self.postMessage({ type: 'config', physicsInterval: currentPhysicsInterval });

  // Also run immediately
  physicsTick();
}

/**
 * Restart physics loop with new interval
 */
function restartPhysics() {
  const newInterval = calculatePhysicsInterval();
  if (newInterval !== currentPhysicsInterval) {
    stopPhysics();
    currentPhysicsInterval = newInterval;
    lastPhysicsTime = performance.now();
    physicsTimer = setInterval(physicsTick, currentPhysicsInterval);

    // Notify main thread of new interval
    self.postMessage({ type: 'config', physicsInterval: currentPhysicsInterval });
  }
}

/**
 * Stop the physics loop
 */
function stopPhysics() {
  if (physicsTimer) {
    clearInterval(physicsTimer);
    physicsTimer = null;
  }
}

/**
 * Send position update using double-buffered transfers
 * Alternates between buffer A and B to avoid per-tick allocation
 */
function sendPositionUpdate() {
  // Select the buffer that's not currently neutered
  const buffer = useBufferA ? transferBufferA : transferBufferB;

  // Check if buffer is valid (not neutered from previous transfer)
  // If neutered, we must reallocate that buffer
  if (!buffer.positions || buffer.positions.byteLength === 0) {
    const bufferSize = positions.length;
    buffer.positions = new Float32Array(bufferSize);
    buffer.velocities = new Float32Array(bufferSize);
  }

  // Copy current positions/velocities into transfer buffer
  buffer.positions.set(positions);
  buffer.velocities.set(velocities);

  // Send with transfer (buffer becomes neutered after this)
  self.postMessage({
    type: 'positions',
    positions: buffer.positions.buffer,
    velocities: buffer.velocities.buffer,
    time: simulationTime.getTime(),
    timeMultiplier: timeMultiplier
  }, [buffer.positions.buffer, buffer.velocities.buffer]);

  // Swap to other buffer for next update
  useBufferA = !useBufferA;
}

/**
 * Handle messages from main thread
 */
self.onmessage = function (e) {
  const { type, data } = e.data;

  switch (type) {
    case 'init':
      initSatellites(data.satellites);
      startPhysics();
      break;

    case 'setTime':
      simulationTime = new Date(data.time);
      lastPhysicsTime = performance.now(); // Reset to prevent large delta on next tick
      // Force immediate update and send positions
      propagateAll(simulationTime);
      // Send updated positions to main thread
      if (positions) {
        sendPositionUpdate();
      }
      break;

    case 'setTimeMultiplier':
      timeMultiplier = data.multiplier;
      // Restart physics loop with new adaptive interval
      if (physicsTimer && !isPaused) {
        restartPhysics();
      }
      break;

    case 'pause':
      isPaused = true;
      break;

    case 'resume':
      isPaused = false;
      lastPhysicsTime = performance.now();
      break;

    case 'stop':
      stopPhysics();
      break;

    case 'addSatellite':
      addSatellite(data.satellite, data.index);
      break;

    default:
    // Unknown message type - silently ignore in production
  }
};

// Export initial physics interval for main thread
self.postMessage({ type: 'config', physicsInterval: currentPhysicsInterval });
