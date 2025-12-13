import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Earth from './components/earth.js';
import Satellite from './components/satellite.js';
import SatelliteManager from './components/satellite-manager.js';
import GroundStation from './components/ground-station.js';
import LineOfSight from './components/line-of-sight.js';
import TimeController from './components/time-controller.js';
import CameraController from './components/camera-controller.js';
import SearchManager from './components/search-manager.js';
import Tooltip from './components/tooltip.js';
import SatelliteTrail from './components/satellite-trail.js';
import GroundTrack from './components/ground-track.js';
import Toast from './components/toast.js';
import { generateTLE } from './data/tle-generator.js';
import { loadPreset as loadPresetData, getPresetList, getCatalogTimestamp } from './data/tle-presets.js';
import * as satellite from 'satellite.js';

class App {
  constructor() {
    // Configuration
    // NOTE: showOrbits and showLineOfSight disabled for v1.0 (performance - "coming soon")
    this.settings = {
      showSatellites: true,
      showOrbits: false,       // DISABLED: coming soon
      showGroundStations: true,
      showLineOfSight: false,  // DISABLED: coming soon
      satelliteTypes: {
        LEO: true,
        MEO: true,
        GEO: true,
        HEO: true
      }
    };

    // Counters and performance tracking
    this.stats = {
      fps: 0,
      lastCalcTime: 0,
      frameCount: 0,
      lastInfoUpdateTime: 0, // For throttling selected info updates
      lastPositionUpdate: 0, // For throttling SGP4 calculations
      lastWorkerTimeSync: 0  // For syncing worker time with main thread
    };

    // Simulation time controller
    this.timeController = new TimeController();

    // Satellite and ground station data
    this.satellites = [];
    this.groundStations = [];
    this.satelliteCount = 0;

    // Object references
    this.earth = null;
    this.lineOfSight = null;
    this.selectedObject = null;

    // Controllers (initialized in init())
    this.cameraController = null;
    this.searchManager = new SearchManager(this);

    // Visualization helpers
    this.tooltip = null;
    this.satelliteTrail = null;
    this.groundTrack = null;
    this.hoveredObject = null;

    // Follow camera tracking (from handoff)
    this.lastFollowTargetPos = new THREE.Vector3();

    // SGP4 Web Worker for off-thread position calculations
    this.sgp4Worker = null;
    this.workerData = {
      positions: null,      // Float32Array from worker
      velocities: null,     // Float32Array for extrapolation
      receiveTime: 0,       // When we received this data (main thread time)
      timeMultiplier: 1,    // Time multiplier at physics calc time
      physicsInterval: 100  // ms between worker physics updates (adaptive)
    };

    // High-performance satellite manager using InstancedMesh
    // Reduces draw calls from N to 1 for massive performance gains
    this.satelliteManager = null;

    // Constellation toggle system - tracks which constellations are currently loaded
    // Enables additive loading (GPS + Starlink + Weather all at once)
    this.loadedConstellations = new Set();
  }

  init() {
    // Create scene
    this.scene = new THREE.Scene();

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      10000000 // Increased to 10 million km to handle extreme distances
    );
    this.camera.position.set(0, 0, 20000);
    this.defaultCameraPosition = this.camera.position.clone();

    // Create renderer with advanced settings
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      precision: 'highp' // Use high precision for better floating point accuracy
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.logarithmicDepthBuffer = true;
    this.renderer.sortObjects = true; // Ensure proper object rendering order

    // Set up advanced depth material properties
    this.renderer.capabilities.logarithmicDepthBuffer = true;
    this.renderer.autoClear = false; // We'll handle clearing manually

    document.body.appendChild(this.renderer.domElement);

    // Uniform ambient lighting (no day/night cycle)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Add soft directional light for depth/shading
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(1, 0.5, 1).normalize();
    this.scene.add(fillLight);

    // Create orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 5000;
    this.controls.maxDistance = 500000;
    this.controls.maxPolarAngle = Math.PI;

    // Store initial control state
    this.controls.saveState();

    // Initialize camera controller
    this.cameraController = new CameraController(this.camera, this.controls);

    // Create Earth
    this.earth = new Earth();
    this.scene.add(this.earth.mesh);

    // Set initial Earth rotation to match current time
    this.earth.setRotationFromTime(this.timeController.current);

    // Initialize line of sight calculator
    this.lineOfSight = new LineOfSight(this.scene);

    // Initialize visualization helpers
    this.tooltip = new Tooltip();
    this.toast = new Toast();
    this.satelliteTrail = new SatelliteTrail(this.scene);
    this.groundTrack = new GroundTrack(this.scene, this.earth.radius, this.earth.mesh);

    // Initialize satellite manager for instanced rendering
    this.satelliteManager = new SatelliteManager(this.scene, 50000);

    // Generate initial satellite data
    this.generateSatellites(this.satelliteCount);

    // Add some default ground stations
    this.addDefaultGroundStations();

    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Add event listener for object selection
    this.renderer.domElement.addEventListener('click', (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.handleObjectSelection(x, y, event);
    });

    // Add mousemove handler for hover tooltip
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

    // Add event listeners for follow controls with explicit event handling
    const followButton = document.getElementById('toggle-follow');
    followButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleFollow();
    });

    const resetButton = document.getElementById('reset-camera');
    resetButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.resetCamera();
    });

    const deselectButton = document.getElementById('deselect-object');
    deselectButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.deselectObject();
    });

    // Add time control event listeners
    this.setupTimeControls();

    // Update info panel initially
    this.updateInfoPanel();
  }

  generateSatellites(count) {
    // Clear existing satellites from manager
    if (this.satelliteManager) {
      this.satelliteManager.clear();
    }
    this.satellites = [];

    // Generate new synthetic TLE data
    const tleData = generateTLE(count);

    // Initialize the instanced mesh for this count
    this.satelliteManager.initialize(count);

    // Create satellite objects via the manager
    // This uses InstancedMesh for rendering (1 draw call instead of N)
    for (let i = 0; i < count; i++) {
      try {
        // Parse TLE to get satrec for orbit calculations
        const satrec = satellite.twoline2satrec(tleData[i].tle1, tleData[i].tle2);

        // Calculate orbital parameters
        const mm = satrec.no; // mean motion (rad/min)
        const period = (2 * Math.PI) / mm;
        const mmRadPerSec = mm / 60;
        const mu = 398600.4418;
        const a = Math.pow(mu / (mmRadPerSec * mmRadPerSec), 1 / 3);
        const altitude = a - 6378.137;

        const orbitParams = {
          period: period,
          inclination: satrec.inclo * 180 / Math.PI,
          eccentricity: satrec.ecco,
          altitude: altitude
        };

        const sat = this.satelliteManager.addSatellite(tleData[i], i, satrec, orbitParams);
        this.satellites.push(sat);
      } catch (e) {
        console.warn(`Failed to create satellite ${i}:`, e);
      }
    }

    // Initialize SGP4 worker with TLE data
    this.initSGP4Worker(tleData);

    // Update satellite count in UI
    document.getElementById('satellite-count').textContent = this.satellites.length;
  }

  /**
   * Load a preset group of real satellites from the bundled catalog
   * @param {string} presetId - Preset ID (e.g., 'iss', 'gps', 'starlink')
   * @returns {boolean} Success status
   * @deprecated Use toggleConstellation() instead for toggle behavior
   */
  loadPreset(presetId) {
    // Legacy behavior: clear and load single preset
    this.loadedConstellations.clear();
    return this.loadConstellation(presetId);
  }

  /**
   * Toggle a constellation on/off
   * @param {string} constellationId - Constellation ID (e.g., 'gps', 'starlink')
   * @returns {boolean} New state (true = loaded, false = unloaded)
   */
  toggleConstellation(constellationId) {
    if (this.loadedConstellations.has(constellationId)) {
      this.unloadConstellation(constellationId);
      return false;
    } else {
      this.loadConstellation(constellationId);
      return true;
    }
  }

  /**
   * Check if a constellation is currently loaded
   * @param {string} constellationId
   * @returns {boolean}
   */
  isConstellationLoaded(constellationId) {
    return this.loadedConstellations.has(constellationId);
  }

  /**
   * Load a constellation (additive - adds to existing satellites)
   * @param {string} constellationId
   * @returns {boolean} Success
   */
  loadConstellation(constellationId) {
    try {
      // Don't load if already loaded
      if (this.loadedConstellations.has(constellationId)) {
        console.log(`Constellation '${constellationId}' already loaded`);
        return true;
      }

      const tleData = loadPresetData(constellationId);
      if (!tleData || tleData.length === 0) {
        console.warn(`Constellation '${constellationId}' has no satellites`);
        return false;
      }

      // Tag each satellite with its constellation ID
      tleData.forEach(sat => sat.constellationId = constellationId);

      // Add to loaded set
      this.loadedConstellations.add(constellationId);

      // Rebuild all satellites from all loaded constellations
      this._rebuildSatellites();

      console.log(`Loaded constellation '${constellationId}' (${tleData.length} satellites). Total: ${this.satellites.length}`);
      return true;

    } catch (error) {
      console.error(`Failed to load constellation '${constellationId}':`, error);
      return false;
    }
  }

  /**
   * Unload a constellation (removes its satellites)
   * @param {string} constellationId
   * @returns {boolean} Success
   */
  unloadConstellation(constellationId) {
    if (!this.loadedConstellations.has(constellationId)) {
      console.log(`Constellation '${constellationId}' not loaded`);
      return false;
    }

    // Remove from loaded set
    this.loadedConstellations.delete(constellationId);

    // Rebuild satellites without this constellation
    this._rebuildSatellites();

    console.log(`Unloaded constellation '${constellationId}'. Total: ${this.satellites.length}`);
    return true;
  }

  /**
   * Rebuild all satellites from currently loaded constellations
   * @private
   */
  _rebuildSatellites() {
    // Collect all TLE data from loaded constellations
    const allTleData = [];
    for (const constellationId of this.loadedConstellations) {
      try {
        const tleData = loadPresetData(constellationId);
        if (tleData) {
          tleData.forEach(sat => {
            sat.constellationId = constellationId;
            allTleData.push(sat);
          });
        }
      } catch (e) {
        console.warn(`Failed to load constellation '${constellationId}':`, e);
      }
    }

    // Clear existing satellites
    if (this.satelliteManager) {
      this.satelliteManager.clear();
    }
    this.satellites = [];

    // If no constellations loaded, just update UI and return
    if (allTleData.length === 0) {
      document.getElementById('satellite-count').textContent = '0';
      // Stop worker since no satellites
      if (this.sgp4Worker) {
        this.sgp4Worker.postMessage({ type: 'stop' });
      }
      return;
    }

    // Initialize the instanced mesh for total count
    this.satelliteManager.initialize(allTleData.length);

    // Create satellite objects from combined TLE data
    for (let i = 0; i < allTleData.length; i++) {
      try {
        const satrec = satellite.twoline2satrec(allTleData[i].tle1, allTleData[i].tle2);

        const mm = satrec.no;
        const period = (2 * Math.PI) / mm;
        const mmRadPerSec = mm / 60;
        const mu = 398600.4418;
        const a = Math.pow(mu / (mmRadPerSec * mmRadPerSec), 1 / 3);
        const altitude = a - 6378.137;

        const orbitParams = {
          period: period,
          inclination: satrec.inclo * 180 / Math.PI,
          eccentricity: satrec.ecco,
          altitude: altitude
        };

        const sat = this.satelliteManager.addSatellite(allTleData[i], i, satrec, orbitParams);
        // Store constellation ID on the satellite object for filtering
        sat.constellationId = allTleData[i].constellationId;
        this.satellites.push(sat);
      } catch (e) {
        console.warn(`Failed to create satellite ${i}:`, e);
      }
    }

    // Initialize SGP4 worker with combined TLE data
    this.initSGP4Worker(allTleData);

    // Update UI
    document.getElementById('satellite-count').textContent = this.satellites.length;
  }

  /**
   * Get list of available presets
   * @returns {Array<{id: string, name: string, count: number}>}
   */
  getAvailablePresets() {
    return getPresetList();
  }

  /**
   * Get timestamp of when the TLE catalog was generated
   * @returns {string} ISO timestamp
   */
  getCatalogDate() {
    return getCatalogTimestamp();
  }

  initSGP4Worker(tleData) {
    // Terminate existing worker if any
    if (this.sgp4Worker) {
      this.sgp4Worker.postMessage({ type: 'stop' });
      this.sgp4Worker.terminate();
    }

    // Create new worker using Vite's worker import pattern
    this.sgp4Worker = new Worker(
      new URL('./workers/orbit-propagator.js', import.meta.url),
      { type: 'module' }
    );

    // Handle messages from worker
    this.sgp4Worker.onmessage = (e) => {
      const { type, ...data } = e.data;

      switch (type) {
        case 'config':
          this.workerData.physicsInterval = data.physicsInterval;
          break;

        case 'initialized':
          console.log(`Orbit Propagator initialized with ${data.count} satellites`);
          break;

        case 'positions':
          // Receive positions and velocities from worker
          this.workerData.positions = new Float32Array(data.positions);
          this.workerData.velocities = new Float32Array(data.velocities);
          this.workerData.receiveTime = performance.now();
          this.workerData.timeMultiplier = data.timeMultiplier;

          break;
      }
    };

    this.sgp4Worker.onerror = (e) => {
      console.error('SGP4 Worker error:', e);
    };

    // Send TLE data to worker
    this.sgp4Worker.postMessage({
      type: 'init',
      data: { satellites: tleData }
    });
  }

  updateSatellitePositionsFromWorker(now) {
    const wd = this.workerData;
    if (!wd.positions) return;

    // Calculate time since we received the physics update
    // Extrapolate positions using velocity for smooth motion between updates
    const dtReal = (now - wd.receiveTime) / 1000; // seconds since receive
    const dtSim = dtReal * wd.timeMultiplier;     // simulation seconds to extrapolate

    this.applySatellitePositions(wd.positions, wd.velocities, dtSim);
  }

  applySatellitePositions(positions, velocities, dtSim) {
    const showOrbits = this.settings.showOrbits;
    const followTarget = this.cameraController.getFollowTarget();
    const typeVisible = this.settings.satelliteTypes;
    const hasVelocity = velocities && dtSim > 0;

    for (let i = 0; i < this.satellites.length; i++) {
      const satellite = this.satellites[i];
      const idx = satellite.workerIndex;
      if (idx === undefined) continue;

      // Quick visibility check
      const isFollowed = satellite === followTarget;
      const isVisible = isFollowed || typeVisible[satellite.type];

      // Skip invisible satellites entirely
      if (!isVisible) {
        satellite.mesh.visible = false;
        if (satellite.hitbox) satellite.hitbox.visible = false;
        if (satellite.orbitLine) satellite.orbitLine.visible = false;
        continue;
      }

      const i3 = idx * 3;
      // SGP4/TEME coordinates: X, Y in equatorial plane, Z toward north pole
      // Three.js coordinates: X, Z in horizontal plane, Y is up
      // Swap Y↔Z to convert from TEME to Three.js
      let temeX = positions[i3];
      let temeY = positions[i3 + 1];
      let temeZ = positions[i3 + 2];

      // Skip invalid positions
      if (temeX === 0 && temeY === 0 && temeZ === 0) continue;

      // Extrapolate using velocity for smooth motion between physics updates
      // velocity is in km/s, dtSim is in seconds
      if (hasVelocity) {
        temeX += velocities[i3] * dtSim;
        temeY += velocities[i3 + 1] * dtSim;
        temeZ += velocities[i3 + 2] * dtSim;
      }

      // Convert TEME to Three.js: swap Y and Z, negate Z to preserve handedness
      const x = temeX;
      const y = temeZ;   // TEME Z (north) → Three.js Y (up)
      const z = -temeY;  // TEME Y → Three.js -Z (negated to preserve orbital direction)

      // Update mesh position (mesh is a proxy object with position Vector3)
      satellite.mesh.position.x = x;
      satellite.mesh.position.y = y;
      satellite.mesh.position.z = z;

      // Update hitbox position for raycasting (hitbox is updated by SatelliteManager.syncToGPU)

      satellite.mesh.visible = true;
      if (satellite.hitbox) satellite.hitbox.visible = true;
      if (satellite.orbitLine) satellite.orbitLine.visible = showOrbits;
      satellite.visible = true;
    }
  }

  addDefaultGroundStations() {
    // Add some default ground stations around the world
    const defaultStations = [
      { name: 'Kennedy Space Center', lat: 28.5, lon: -80.6 },
      { name: 'Baikonur Cosmodrome', lat: 45.6, lon: 63.3 },
      { name: 'ESA Kourou', lat: 5.2, lon: -52.8 },
      { name: 'JAXA Tanegashima', lat: 30.4, lon: 130.9 }
    ];

    for (const station of defaultStations) {
      const groundStation = new GroundStation(station);
      groundStation.add(this.scene, this.earth.radius);
      this.groundStations.push(groundStation);
    }

    // Update ground station count in UI
    document.getElementById('groundstation-count').textContent = this.groundStations.length;
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    // Calculate and display FPS
    this.calculateFPS();

    // Update simulation time
    this.timeController.update();
    this.updateClockDisplay();

    // Update satellite positions using interpolated worker data
    const now = performance.now();
    this.updateSatellitePositionsFromWorker(now);

    // Sync Earth rotation to simulation time using GMST
    // This ensures Earth and satellite positions (both based on absolute time) stay in sync
    this.earth.setRotationFromTime(this.timeController.current);

    // Periodically sync worker time with main thread to prevent drift at high warp speeds
    // Sync every 500ms or when time multiplier is high
    const syncInterval = Math.abs(this.timeController.multiplier) > 10 ? 100 : 500;
    if (now - this.stats.lastWorkerTimeSync >= syncInterval) {
      if (this.sgp4Worker) {
        this.sgp4Worker.postMessage({
          type: 'setTime',
          data: { time: this.timeController.current.getTime() }
        });
      }
      this.stats.lastWorkerTimeSync = now;
    }

    // Update ground station positions to rotate with Earth
    for (const station of this.groundStations) {
      station.updateWithEarthRotation(this.earth.getMesh());
    }

    // Update camera follow using delta-based tracking
    const followTarget = this.cameraController.getFollowTarget();
    if (followTarget && followTarget.mesh) {
      const targetPos = followTarget.mesh.position.clone();
      const delta = targetPos.clone().sub(this.lastFollowTargetPos);
      this.lastFollowTargetPos.copy(targetPos);

      // Only move if delta is significant
      if (delta.lengthSq() > 0.1) {
        this.camera.position.add(delta);
        this.controls.target.copy(targetPos);
      }
    }

    // Always update controls
    this.controls.update();

    // Update line of sight for selected satellite only (not all satellites)
    if (this.settings.showLineOfSight && this.selectedObject && this.selectedObject.tleData) {
      this.lineOfSight.update(this.groundStations, [this.selectedObject]);
    } else if (this.settings.showLineOfSight) {
      // Clear LOS lines if no satellite selected
      this.lineOfSight.update(this.groundStations, []);
    }

    // Update selected info panel if a ground station is selected
    // Throttled to 10 updates per second (every 100ms) for performance
    if (this.selectedObject instanceof GroundStation) {
      if (now - this.stats.lastInfoUpdateTime >= 100) {
        this.updateSelectedInfo();
        this.stats.lastInfoUpdateTime = now;
      }
    }

    // Update satellite trail, ground track, and orbit line if a satellite is selected
    if (this.selectedObject && this.selectedObject.mesh) {
      this.satelliteTrail.update(this.timeController.current);
      this.groundTrack.update(this.timeController.current);

      // Refresh orbit line if simulation time has drifted significantly from orbit epoch
      // This keeps orbit line synchronized with ground track during time warp
      if (this.satelliteManager && this.selectedObject.orbitLine) {
        this.satelliteManager.updateOrbitLineIfNeeded(this.selectedObject, this.timeController.current);
      }
    }

    // Sync satellite positions to GPU (InstancedMesh)
    // This is the key performance optimization: 1 draw call for all satellites
    if (this.satelliteManager) {
      this.satelliteManager.updateScales(this.camera);
      this.satelliteManager.syncToGPU();
    }

    // Render scene with extreme distance handling
    this.render();
  }

  calculateFPS() {
    this.stats.frameCount++;
    const now = performance.now();

    // Update FPS every second
    if (now - this.stats.lastCalcTime >= 1000) {
      this.stats.fps = Math.round((this.stats.frameCount * 1000) / (now - this.stats.lastCalcTime));
      document.getElementById('fps').textContent = this.stats.fps;

      this.stats.frameCount = 0;
      this.stats.lastCalcTime = now;
    }
  }

  updateClockDisplay() {
    const clockElement = document.getElementById('simulation-clock');
    if (clockElement) {
      clockElement.textContent = this.timeController.getFormattedTime();
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  handleObjectSelection(x, y, event) {
    // Don't process clicks on UI elements
    if (event && event.target !== this.renderer.domElement) {
      return;
    }

    const raycaster = new THREE.Raycaster();
    const mousePosition = new THREE.Vector2(x, y);

    raycaster.setFromCamera(mousePosition, this.camera);

    // Get all selectable objects (use hitboxes for satellites for easier clicking)
    const selectableObjects = [
      ...this.satellites.map(sat => sat.hitbox),
      ...this.groundStations.map(station => station.mesh)
    ];

    const intersects = raycaster.intersectObjects(selectableObjects);

    if (intersects.length > 0) {
      const selectedMesh = intersects[0].object;
      // Check if the userData has a direct satellite reference (from hitbox)
      let newSelection = selectedMesh.userData.satellite;
      // Otherwise look it up in ground stations
      if (!newSelection) {
        newSelection = this.groundStations.find(station => station.mesh === selectedMesh);
      }

      // Toggle selection if clicking the same object, otherwise select new
      if (this.selectedObject === newSelection) {
        // Clicking same object deselects it
        this.selectedObject = null;
        this.updateSelectedInfo();
        // Clear SGP4 priority when deselecting
        if (this.sgp4Worker) {
          this.sgp4Worker.postMessage({ type: 'setSGP4Priority', data: { index: -1 } });
        }
      } else {
        this.selectedObject = newSelection;
        this.updateSelectedInfo();
        // Set SGP4 priority for selected satellite (for accurate position data)
        if (this.sgp4Worker && newSelection && newSelection.workerIndex !== undefined) {
          this.sgp4Worker.postMessage({ type: 'setSGP4Priority', data: { index: newSelection.workerIndex } });
        }
      }
    }
    // No click-away deselection - require clicking the object again to deselect
  }

  handleHover(x, y, screenX, screenY) {
    const raycaster = new THREE.Raycaster();
    const mousePosition = new THREE.Vector2(x, y);

    raycaster.setFromCamera(mousePosition, this.camera);

    // Get all hoverable objects (use hitboxes for satellites)
    const hoverableObjects = [
      ...this.satellites.map(sat => sat.hitbox),
      ...this.groundStations.map(station => station.mesh)
    ];

    const intersects = raycaster.intersectObjects(hoverableObjects);

    if (intersects.length > 0) {
      const hoveredMesh = intersects[0].object;
      let hoveredObject = hoveredMesh.userData.satellite;

      if (!hoveredObject) {
        hoveredObject = this.groundStations.find(station => station.mesh === hoveredMesh);
      }

      if (hoveredObject && hoveredObject !== this.hoveredObject) {
        this.hoveredObject = hoveredObject;

        // Build tooltip data
        let tooltipData;
        // Use duck typing: satellites have tleData, ground stations have lat/lon
        if (hoveredObject.tleData) {
          tooltipData = {
            type: 'satellite',
            name: hoveredObject.tleData.name,
            objectType: hoveredObject.type,
            altitude: hoveredObject.orbit.altitude,
            period: hoveredObject.orbit.period,
            inclination: hoveredObject.orbit.inclination
          };
        } else if (hoveredObject.lat !== undefined) {
          const visibleCount = this.lineOfSight.getVisibleSatellitesFor(
            hoveredObject,
            this.satellites.filter(s => this.isSatelliteVisible(s))
          );
          tooltipData = {
            type: 'groundStation',
            name: hoveredObject.name,
            lat: hoveredObject.lat,
            lon: hoveredObject.lon,
            visibleCount: visibleCount
          };
        }

        this.tooltip.show(screenX, screenY, tooltipData);
      } else if (hoveredObject === this.hoveredObject) {
        // Same object, just update position
        this.tooltip.updatePosition(screenX, screenY);
      }
    } else {
      // No hover
      if (this.hoveredObject) {
        this.hoveredObject = null;
        this.tooltip.hide();
      }
    }
  }

  updateSelectedInfo() {
    const infoElement = document.getElementById('selected-info');
    const followControls = document.getElementById('follow-controls');
    const followButton = document.getElementById('toggle-follow');
    const selectedObjectControls = document.getElementById('selected-object-controls');

    // Clear previous selection's orbit line if we're selecting a different satellite
    if (this._lastSelectedSatellite &&
      this._lastSelectedSatellite !== this.selectedObject &&
      this.satelliteManager) {
      this.satelliteManager.removeOrbitLine(this._lastSelectedSatellite);
    }

    if (this.selectedObject) {
      let html = '';

      // Use duck typing: satellites have tleData, ground stations have lat/lon
      if (this.selectedObject.tleData) {
        const sat = this.selectedObject;

        // Calculate TLE age
        let tleAgeStr = '—';
        let tleAgeClass = '';
        let tleAgeDays = 0;
        if (sat.satrec) {
          // Convert epoch to Date
          const epochYear = sat.satrec.epochyr < 57 ? 2000 + sat.satrec.epochyr : 1900 + sat.satrec.epochyr;
          const epochDate = new Date(epochYear, 0, 1);
          epochDate.setDate(epochDate.getDate() + sat.satrec.epochdays - 1);

          // Calculate age in days from current sim time
          const simTime = this.timeController.current;
          tleAgeDays = Math.floor((simTime - epochDate) / (1000 * 60 * 60 * 24));

          if (tleAgeDays < 0) {
            tleAgeStr = `${Math.abs(tleAgeDays)}d future`;
            tleAgeClass = 'tle-warning';
          } else if (tleAgeDays === 0) {
            tleAgeStr = 'Today';
            tleAgeClass = 'tle-good';
          } else if (tleAgeDays <= 7) {
            tleAgeStr = `${tleAgeDays}d old`;
            tleAgeClass = 'tle-good';
          } else if (tleAgeDays <= 30) {
            tleAgeStr = `${tleAgeDays}d old`;
            tleAgeClass = 'tle-warning';
          } else {
            tleAgeStr = `${tleAgeDays}d old`;
            tleAgeClass = 'tle-stale';
          }
        }

        // Get eccentricity from satrec
        const eccentricity = sat.satrec ? sat.satrec.ecco : 0;

        html += `<div class="object-name">${sat.tleData.name}</div>`;
        html += `<div class="object-type">Satellite • ${sat.type}</div>`;

        // TLE Health indicator
        html += `<div class="tle-health ${tleAgeClass}">`;
        html += `<span class="material-icons" style="font-size: 14px;">schedule</span>`;
        html += `<span>TLE: ${tleAgeStr}</span>`;
        html += `</div>`;

        // Orbital parameters
        html += `<div class="spec-grid">`;
        html += `<span class="spec-label">Period</span><span class="spec-value">${sat.orbit.period.toFixed(2)} min</span>`;
        html += `<span class="spec-label">Altitude</span><span class="spec-value">${sat.orbit.altitude.toFixed(0)} km</span>`;
        html += `<span class="spec-label">Inclination</span><span class="spec-value">${sat.orbit.inclination.toFixed(2)}°</span>`;
        html += `<span class="spec-label">Eccentricity</span><span class="spec-value">${eccentricity.toFixed(4)}</span>`;
        html += `</div>`;

        // Show position jump toast on new satellite selection
        // The Keplerian→SGP4 propagation switch causes visible position shift
        if (this._lastSelectedSatellite !== sat) {
          this.toast.show(
            `Position adjusted for selection. Switching from fast Keplerian to precise SGP4 propagation.`,
            { type: 'info', duration: 4000, icon: 'sync_alt' }
          );
        }

        // Enable trail and ground track for selected satellite
        this.satelliteTrail.setTarget(sat);
        this.satelliteTrail.setColorByType(sat.type);
        this.groundTrack.setTarget(sat);

        // Sync visualization states with current UI toggle values
        // This handles browser auto-restore of checkbox states on refresh
        const trailToggle = document.getElementById('toggle-trail');
        const groundTrackToggle = document.getElementById('toggle-ground-track');
        const orbitToggle = document.getElementById('toggle-orbit-selected');
        const losToggle = document.getElementById('toggle-los-selected');

        if (trailToggle) {
          this.satelliteTrail.toggleVisibility(trailToggle.checked);
        }
        if (groundTrackToggle) {
          this.groundTrack.toggleVisibility(groundTrackToggle.checked);
        }
        if (orbitToggle && orbitToggle.checked) {
          this.settings.showOrbits = true;
        }
        if (losToggle) {
          this.settings.showLineOfSight = losToggle.checked;
          this.lineOfSight.toggleVisibility(losToggle.checked);
        }

        // Create orbit line for selected satellite (using simulation time for accuracy)
        if (this.satelliteManager && this.settings.showOrbits && !sat.orbitLine) {
          this.satelliteManager.createOrbitLine(sat, this.timeController.current);
        }

        // Show satellite-specific controls
        selectedObjectControls.style.display = 'block';
      } else if (this.selectedObject.lat !== undefined) {
        const station = this.selectedObject;
        html += `<div class="object-name">${station.name}</div>`;
        html += `<div class="object-type">Ground Station</div>`;

        // Count visible satellites
        const visibleCount = this.lineOfSight.getVisibleSatellitesFor(station,
          this.satellites.filter(s => this.isSatelliteVisible(s)));

        html += `<div class="spec-grid">`;
        html += `<span class="spec-label">Latitude</span><span class="spec-value">${station.lat.toFixed(2)}°</span>`;
        html += `<span class="spec-label">Longitude</span><span class="spec-value">${station.lon.toFixed(2)}°</span>`;
        html += `<span class="spec-label">Visible Sats</span><span class="spec-value">${visibleCount}</span>`;
        html += `</div>`;

        // Hide satellite-specific controls for ground stations
        selectedObjectControls.style.display = 'none';
      }

      infoElement.innerHTML = html;
      followControls.style.display = 'flex';
      const isFollowing = this.cameraController.getFollowTarget() === this.selectedObject;
      followButton.innerHTML = isFollowing
        ? '<span class="material-icons">videocam_off</span> STOP'
        : '<span class="material-icons">videocam</span> TRACK';
      followButton.classList.toggle('active', isFollowing);
    } else {
      infoElement.innerHTML = `
        <div class="no-selection">
          <span class="material-icons">touch_app</span>
          <p>SELECT TARGET</p>
        </div>`;
      followControls.style.display = 'none';
      selectedObjectControls.style.display = 'none';

      // Clear trail, ground track, and orbit line when deselecting
      this.satelliteTrail.clearTrail();
      this.groundTrack.clearTrack();

      // Remove orbit line from previously selected satellite
      if (this._lastSelectedSatellite && this.satelliteManager) {
        this.satelliteManager.removeOrbitLine(this._lastSelectedSatellite);
        this._lastSelectedSatellite = null;
      }
    }

    // Track selected satellite for orbit cleanup
    if (this.selectedObject && this.selectedObject.tleData) {
      this._lastSelectedSatellite = this.selectedObject;
    }
  }

  toggleFollow() {
    const isNowFollowing = this.cameraController.toggleFollow(this.selectedObject);

    // Initialize lastFollowTargetPos when starting to follow
    if (isNowFollowing && this.selectedObject && this.selectedObject.mesh) {
      this.lastFollowTargetPos.copy(this.selectedObject.mesh.position);
    }

    // Update button state
    const followButton = document.getElementById('toggle-follow');
    followButton.innerHTML = isNowFollowing
      ? '<span class="material-icons">videocam_off</span> STOP'
      : '<span class="material-icons">videocam</span> TRACK';
    followButton.classList.toggle('active', isNowFollowing);
  }

  resetCamera() {
    this.cameraController.reset();

    // Update button state
    const followButton = document.getElementById('toggle-follow');
    followButton.innerHTML = '<span class="material-icons">videocam</span> TRACK';
    followButton.classList.remove('active');
  }

  deselectObject() {
    // Stop following if we were following
    if (this.cameraController.getFollowTarget()) {
      this.cameraController.reset();
    }

    this.selectedObject = null;
    this.updateSelectedInfo();

    // Clear SGP4 priority when deselecting
    if (this.sgp4Worker) {
      this.sgp4Worker.postMessage({ type: 'setSGP4Priority', data: { index: -1 } });
    }

    // Reset follow button state
    const followButton = document.getElementById('toggle-follow');
    followButton.innerHTML = '<span class="material-icons">videocam</span> TRACK';
    followButton.classList.remove('active');
  }

  updateInfoPanel() {
    document.getElementById('satellite-count').textContent = this.satellites.length;
    document.getElementById('groundstation-count').textContent = this.groundStations.length;
  }

  // UI control methods
  setSatelliteCount(count) {
    this.satelliteCount = count;
    this.generateSatellites(count);
  }

  toggleSatellites(visible) {
    this.settings.showSatellites = visible;
    for (const satellite of this.satellites) {
      satellite.toggleVisibility(visible && this.isSatelliteTypeVisible(satellite.type));
    }
  }

  toggleOrbits(visible) {
    this.settings.showOrbits = visible;

    // Create orbit line for selected satellite if it doesn't exist
    if (visible && this.selectedObject && this.selectedObject.tleData && !this.selectedObject.orbitLine) {
      if (this.satelliteManager) {
        this.satelliteManager.createOrbitLine(this.selectedObject, this.timeController.current);
      }
    }

    for (const satellite of this.satellites) {
      if (this.isSatelliteVisible(satellite)) {
        satellite.toggleOrbit(visible);
      }
    }
  }

  toggleGroundStations(visible) {
    this.settings.showGroundStations = visible;
    for (const station of this.groundStations) {
      station.toggleVisibility(visible);
    }
  }

  setupTimeControls() {
    // Play/Pause button
    const playPauseBtn = document.getElementById('time-play-pause');
    playPauseBtn.addEventListener('click', () => this.toggleTimePause());

    // Reset to now button
    const resetBtn = document.getElementById('time-reset');
    resetBtn.addEventListener('click', () => this.resetTime());

    // Speed buttons
    const speedButtons = document.querySelectorAll('.time-speed-btn');
    speedButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        this.setTimeSpeed(speed);

        // Update active state
        speedButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  setTimeSpeed(multiplier) {
    this.timeController.setSpeed(multiplier);

    // Sync worker with new time multiplier and current time
    if (this.sgp4Worker) {
      // Sync time first to ensure alignment
      this.sgp4Worker.postMessage({ type: 'setTime', data: { time: this.timeController.current.getTime() } });
      this.sgp4Worker.postMessage({ type: 'setTimeMultiplier', data: { multiplier } });
    }

    // Update display
    const display = document.getElementById('time-speed-display');
    if (display) {
      display.textContent = `${multiplier}x`;
      display.style.color = multiplier < 0 ? '#f44336' : '#4CAF50';
    }

    // Update play/pause button if auto-unpaused
    if (!this.timeController.isPaused) {
      const playPauseBtn = document.getElementById('time-play-pause');
      playPauseBtn.innerHTML = '<span class="material-icons">pause</span>';
    }
  }

  toggleTimePause() {
    const isPaused = this.timeController.togglePause();

    // Sync worker with pause state
    if (this.sgp4Worker) {
      this.sgp4Worker.postMessage({ type: isPaused ? 'pause' : 'resume' });
    }

    const playPauseBtn = document.getElementById('time-play-pause');
    playPauseBtn.innerHTML = isPaused
      ? '<span class="material-icons">play_arrow</span>'
      : '<span class="material-icons">pause</span>';
  }

  resetTime() {
    this.timeController.reset();
    this.updateClockDisplay();

    // Sync worker with new time
    if (this.sgp4Worker) {
      this.sgp4Worker.postMessage({ type: 'setTime', data: { time: this.timeController.current.getTime() } });
    }

    // Sync Earth rotation to new time
    this.earth.setRotationFromTime(this.timeController.current);
  }

  speedUp() {
    const speeds = [-10, -1, 1, 10, 60, 100, 1000];
    const currentSpeed = this.timeController.multiplier;
    const currentIndex = speeds.indexOf(currentSpeed);
    const nextIndex = Math.min(currentIndex + 1, speeds.length - 1);
    this.setTimeSpeed(speeds[nextIndex]);
    this.updateSpeedButtons(speeds[nextIndex]);
  }

  slowDown() {
    const speeds = [-10, -1, 1, 10, 60, 100, 1000];
    const currentSpeed = this.timeController.multiplier;
    const currentIndex = speeds.indexOf(currentSpeed);
    const prevIndex = Math.max(currentIndex - 1, 0);
    this.setTimeSpeed(speeds[prevIndex]);
    this.updateSpeedButtons(speeds[prevIndex]);
  }

  updateSpeedButtons(speed) {
    document.querySelectorAll('.time-speed-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.speed) === speed);
    });
  }

  toggleLineOfSight(visible) {
    this.settings.showLineOfSight = visible;
    this.lineOfSight.toggleVisibility(visible);
  }

  toggleTrail(visible) {
    if (this.satelliteTrail) {
      this.satelliteTrail.toggleVisibility(visible);
    }
  }

  toggleGroundTrack(visible) {
    if (this.groundTrack) {
      this.groundTrack.toggleVisibility(visible);
    }
  }

  toggleSatelliteType(type, visible) {
    this.settings.satelliteTypes[type] = visible;

    for (const satellite of this.satellites) {
      if (satellite.type === type) {
        satellite.toggleVisibility(visible && this.settings.showSatellites);
      }
    }
  }

  isSatelliteTypeVisible(type) {
    return this.settings.satelliteTypes[type] || false;
  }

  isSatelliteVisible(satellite) {
    return this.settings.showSatellites && this.isSatelliteTypeVisible(satellite.type);
  }

  render() {
    // Clear buffers
    this.renderer.clear();

    // Note: Satellite scaling is now handled by SatelliteManager.updateScales()
    // called in animate() before syncToGPU() - this eliminates per-satellite loop here

    // Render scene
    this.renderer.render(this.scene, this.camera);
  }

  // Search methods
  searchObjects(query, type = 'all') {
    return this.searchManager.search(query, type);
  }

  selectObject(object) {
    // Set as selected object
    this.selectedObject = object.object;

    // Update info panel
    this.updateSelectedInfo();

    // Show follow controls
    document.getElementById('follow-controls').style.display = 'block';

    // Return the selected object for further operations
    return this.selectedObject;
  }

  followSelectedObject() {
    // If no object is selected, do nothing
    if (!this.selectedObject) {
      return false;
    }

    // Set as follow target
    this.toggleFollow();
    return true;
  }

  zoomToObject(object) {
    this.cameraController.zoomTo(object);
  }

  /**
   * Add a custom satellite from TLE data
   * @param {string} name - Satellite name
   * @param {string} tle1 - TLE line 1
   * @param {string} tle2 - TLE line 2
   * @returns {Object} - Result object with success status and message/satellite
   */
  addCustomTLE(name, tle1, tle2) {
    // Validate inputs
    if (!name || !name.trim()) {
      return { success: false, message: 'Satellite name is required' };
    }

    if (!tle1 || !tle1.trim()) {
      return { success: false, message: 'TLE Line 1 is required' };
    }

    if (!tle2 || !tle2.trim()) {
      return { success: false, message: 'TLE Line 2 is required' };
    }

    // Clean up the inputs
    name = name.trim();
    tle1 = tle1.trim();
    tle2 = tle2.trim();

    // Basic TLE format validation
    if (!tle1.startsWith('1 ')) {
      return { success: false, message: 'TLE Line 1 must start with "1 "' };
    }

    if (!tle2.startsWith('2 ')) {
      return { success: false, message: 'TLE Line 2 must start with "2 "' };
    }

    // TLE lines should be 69 characters (can be slightly flexible)
    if (tle1.length < 60 || tle1.length > 75) {
      return { success: false, message: 'TLE Line 1 appears to have invalid length' };
    }

    if (tle2.length < 60 || tle2.length > 75) {
      return { success: false, message: 'TLE Line 2 appears to have invalid length' };
    }

    try {
      // Create TLE data object
      const tleData = {
        name: name,
        tle1: tle1,
        tle2: tle2
      };

      // Parse TLE to get satrec for orbit calculations
      const satrec = satellite.twoline2satrec(tle1, tle2);

      // Calculate orbital parameters (same logic as generateSatellites)
      const mm = satrec.no; // mean motion (rad/min)
      const period = (2 * Math.PI) / mm;
      const mmRadPerSec = mm / 60;
      const mu = 398600.4418;
      const a = Math.pow(mu / (mmRadPerSec * mmRadPerSec), 1 / 3);
      const altitude = a - 6378.137;

      const orbitParams = {
        period: period,
        inclination: satrec.inclo * 180 / Math.PI,
        eccentricity: satrec.ecco,
        altitude: altitude
      };

      // Get the next available index
      const workerIndex = this.satellites.length;

      // Add satellite via SatelliteManager (uses InstancedMesh for performance)
      const sat = this.satelliteManager.addSatellite(tleData, workerIndex, satrec, orbitParams);

      // Add to satellites array
      this.satellites.push(sat);

      // Update the SGP4 worker with the new satellite
      if (this.sgp4Worker) {
        this.sgp4Worker.postMessage({
          type: 'addSatellite',
          data: { satellite: tleData, index: workerIndex }
        });
      }

      // Update UI count
      document.getElementById('satellite-count').textContent = this.satellites.length;

      return {
        success: true,
        message: `Successfully added "${name}" (${sat.type})`,
        satellite: sat
      };

    } catch (error) {
      console.error('Failed to add custom TLE:', error);
      return {
        success: false,
        message: `Failed to parse TLE: ${error.message}`
      };
    }
  }

  /**
   * Parse a full TLE string (3 lines) into components
   * @param {string} fullTLE - Full TLE text with name and two TLE lines
   * @returns {Object} - Parsed TLE data or error
   */
  parseTLEString(fullTLE) {
    if (!fullTLE || !fullTLE.trim()) {
      return { success: false, message: 'TLE text is empty' };
    }

    // Split by newlines, handling different line endings
    const lines = fullTLE.trim().split(/\r?\n/).map(line => line.trim()).filter(line => line);

    if (lines.length < 2) {
      return { success: false, message: 'TLE must have at least 2 lines (TLE line 1 and line 2)' };
    }

    let name, tle1, tle2;

    if (lines.length >= 3) {
      // 3-line format: name, tle1, tle2
      name = lines[0];
      tle1 = lines[1];
      tle2 = lines[2];
    } else if (lines.length === 2) {
      // 2-line format: tle1, tle2 (name will need to be provided separately)
      name = '';
      tle1 = lines[0];
      tle2 = lines[1];
    }

    return { success: true, name, tle1, tle2 };
  }
}

export default App;
