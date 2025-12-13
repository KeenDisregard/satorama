import App from './app.js';
import Walkthrough from './components/walkthrough.js';

// Initialize the application on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();

  // Start the animation loop
  app.animate();

  // Set up UI event listeners
  setupEventListeners(app);

  // Set up search functionality
  setupSearchFeature(app);

  // Set up TLE modal functionality
  setupTLEModal(app);

  // Set up keyboard shortcuts
  setupKeyboardShortcuts(app);

  // Set up preset buttons
  setupPresets(app);

  // Set up walkthrough / onboarding tutorial
  setupWalkthrough();
});

// Set up constellation toggle buttons (formerly presets)
function setupPresets(app) {
  const presetContainer = document.getElementById('preset-buttons');
  const presetDateDisplay = document.getElementById('preset-date');

  if (!presetContainer) return;

  // Get available presets (constellations)
  const presets = app.getAvailablePresets();

  // Featured constellations to show
  const featured = ['iss', 'gps', 'brightest', 'starlink', 'weather', 'stations'];

  // Store button references for active state management
  const buttons = {};

  // Create toggle buttons for featured constellations
  featured.forEach(presetId => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.dataset.constellationId = presetId;
    buttons[presetId] = btn;

    // Short display names
    const displayNames = {
      'iss': 'ISS',
      'gps': 'GPS',
      'brightest': 'BRIGHT',
      'starlink': 'STARLINK',
      'weather': 'WEATHER',
      'stations': 'STATIONS'
    };

    btn.innerHTML = `
      <span>${displayNames[presetId] || preset.name}</span>
      <span class="preset-count">${preset.count}</span>
    `;

    // Set tooltip showing constellation description
    if (preset.description) {
      btn.title = preset.description;
    }

    btn.addEventListener('click', () => {
      // Toggle this constellation
      const isNowActive = app.toggleConstellation(presetId);

      // Update button active state
      btn.classList.toggle('active', isNowActive);

      // Reset synthetic density slider when first constellation is loaded
      if (isNowActive && app.loadedConstellations.size === 1) {
        const slider = document.getElementById('satellite-slider');
        const sliderValue = document.getElementById('satellite-slider-value');
        if (slider && sliderValue) {
          slider.value = 0;
          sliderValue.textContent = '0';
        }
      }
    });

    presetContainer.appendChild(btn);
  });

  // Show catalog date
  try {
    const timestamp = app.getCatalogDate();
    const date = new Date(timestamp);
    presetDateDisplay.textContent = `DATA: ${date.toLocaleDateString()}`;
  } catch (e) {
    presetDateDisplay.textContent = '';
  }

  // Load GPS by default on startup (32 satellites - visually interesting)
  try {
    app.loadConstellation('gps');
    if (buttons['gps']) {
      buttons['gps'].classList.add('active');
    }
  } catch (e) {
    console.warn('Could not load default constellation:', e);
  }
}

// Debounce function to limit how often a function is called
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Set up UI event listeners
function setupEventListeners(app) {
  // Satellite count slider
  const satelliteSlider = document.getElementById('satellite-slider');
  const satelliteSliderValue = document.getElementById('satellite-slider-value');

  // Update the display value immediately without regenerating satellites
  satelliteSlider.addEventListener('input', () => {
    satelliteSliderValue.textContent = satelliteSlider.value;
  });

  // Apply the actual satellite count change with debouncing (500ms delay)
  const debouncedSatelliteUpdate = debounce((value) => {
    app.setSatelliteCount(parseInt(value));
  }, 500);

  // Trigger the debounced update on change or when user stops interacting
  satelliteSlider.addEventListener('change', () => {
    debouncedSatelliteUpdate(satelliteSlider.value);
  });

  // Also update when user stops sliding but hasn't released
  satelliteSlider.addEventListener('mouseup', () => {
    debouncedSatelliteUpdate(satelliteSlider.value);
  });

  satelliteSlider.addEventListener('touchend', () => {
    debouncedSatelliteUpdate(satelliteSlider.value);
  });

  // Toggle visibility controls
  document.getElementById('toggle-satellites').addEventListener('change', (e) => {
    app.toggleSatellites(e.target.checked);
  });

  document.getElementById('toggle-groundstations').addEventListener('change', (e) => {
    app.toggleGroundStations(e.target.checked);
  });

  // Trail and ground track toggles
  document.getElementById('toggle-trail').addEventListener('change', (e) => {
    app.toggleTrail(e.target.checked);
  });

  document.getElementById('toggle-ground-track').addEventListener('change', (e) => {
    app.toggleGroundTrack(e.target.checked);
  });

  // Selected satellite specific toggles (in left panel)
  document.getElementById('toggle-orbit-selected').addEventListener('change', (e) => {
    app.toggleOrbits(e.target.checked);
  });

  document.getElementById('toggle-los-selected').addEventListener('change', (e) => {
    app.toggleLineOfSight(e.target.checked);
  });

  // Satellite type filters
  document.querySelectorAll('.satellite-type').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      app.toggleSatelliteType(e.target.dataset.type, e.target.checked);
    });
  });

  // Note: Follow and reset camera listeners are set up in app.js init()

  // Sync initial app state with toggle values (handles browser auto-restore of form state)
  syncInitialToggleStates(app);
}

/**
 * Sync app settings with current toggle states on page load
 * Browsers may auto-restore checkbox states from cache, so we need to apply them
 */
function syncInitialToggleStates(app) {
  // Main toggles
  const satToggle = document.getElementById('toggle-satellites');
  const gsToggle = document.getElementById('toggle-groundstations');

  if (satToggle) app.settings.showSatellites = satToggle.checked;
  if (gsToggle) app.settings.showGroundStations = gsToggle.checked;

  // Satellite type filters
  document.querySelectorAll('.satellite-type').forEach(checkbox => {
    const type = checkbox.dataset.type;
    if (type && app.settings.satelliteTypes) {
      app.settings.satelliteTypes[type] = checkbox.checked;
    }
  });

  // Selected satellite toggles - call toggle methods to properly initialize
  const orbitToggle = document.getElementById('toggle-orbit-selected');
  const losToggle = document.getElementById('toggle-los-selected');

  if (orbitToggle) {
    app.settings.showOrbits = orbitToggle.checked;
  }
  if (losToggle) {
    app.toggleLineOfSight(losToggle.checked);
  }
}

// Set up search functionality
function setupSearchFeature(app) {
  // Get search UI elements
  const searchToggle = document.getElementById('search-toggle');
  const searchSidebar = document.getElementById('search-sidebar');
  const searchInput = document.getElementById('search-input');
  const searchType = document.getElementById('search-type');
  const searchResults = document.getElementById('search-results');
  const resultsCount = document.getElementById('results-count');

  // Toggle search sidebar
  searchToggle.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event from bubbling up
    searchSidebar.classList.toggle('open');
    if (searchSidebar.classList.contains('open')) {
      searchInput.focus();
    }
  });

  // Close sidebar when clicking outside (modified to be more reliable)
  document.addEventListener('mousedown', (e) => {
    // Only process if sidebar is open and click is outside sidebar and not on toggle button
    if (searchSidebar.classList.contains('open') &&
      !searchSidebar.contains(e.target) &&
      e.target !== searchToggle) {
      searchSidebar.classList.remove('open');
    }
  });

  // Perform search on input (debounced)
  const performSearch = debounce(() => {
    const query = searchInput.value;
    const type = searchType.value;

    // Clear previous results
    searchResults.innerHTML = '';

    // If query is empty, don't search
    if (!query.trim()) {
      searchResults.innerHTML = '<div class="no-results">Enter a search term</div>';
      resultsCount.textContent = 0;
      return;
    }

    // Perform search
    const results = app.searchObjects(query, type);

    // Update results count
    resultsCount.textContent = results.length;

    // Display results
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="no-results">No matches found</div>';
      return;
    }

    // Create result items
    results.forEach(result => {
      const resultElem = document.createElement('div');
      resultElem.className = 'search-result';

      // Create result details
      const nameElem = document.createElement('div');
      nameElem.className = 'search-result-name';
      nameElem.textContent = result.name;

      // Add object type as subtitle
      const typeInfo = document.createElement('small');
      typeInfo.style.display = 'block';
      typeInfo.style.color = '#aaa';

      if (result.type === 'satellite') {
        typeInfo.textContent = `Satellite (${result.objectType})`;
      } else {
        typeInfo.textContent = `Ground Station (${result.location})`;
      }

      nameElem.appendChild(typeInfo);
      resultElem.appendChild(nameElem);

      // Create actions container
      const actionsElem = document.createElement('div');
      actionsElem.className = 'search-result-actions';

      // Create select button
      const selectBtn = document.createElement('button');
      selectBtn.textContent = 'Select';
      selectBtn.addEventListener('click', () => {
        // Select the object
        const selected = app.selectObject(result);

        // Highlight the selected result
        document.querySelectorAll('.search-result').forEach(el => {
          el.style.borderLeft = 'none';
        });
        resultElem.style.borderLeft = '3px solid #4CAF50';
      });
      actionsElem.appendChild(selectBtn);

      // Create follow button
      const followBtn = document.createElement('button');
      followBtn.textContent = 'Follow';
      followBtn.addEventListener('click', () => {
        // Select the object first
        const selected = app.selectObject(result);

        // Then follow it
        if (selected) {
          app.followSelectedObject();
        }
      });
      actionsElem.appendChild(followBtn);

      // Create zoom button
      const zoomBtn = document.createElement('button');
      zoomBtn.textContent = 'Zoom';
      zoomBtn.addEventListener('click', () => {
        // Zoom to the object
        app.zoomToObject(result.object);
      });
      actionsElem.appendChild(zoomBtn);

      resultElem.appendChild(actionsElem);
      searchResults.appendChild(resultElem);
    });
  }, 300);

  // Add event listeners for search
  searchInput.addEventListener('input', performSearch);
  searchType.addEventListener('change', performSearch);

  // Add keyboard shortcut for search (Ctrl+F)
  document.addEventListener('keydown', (e) => {
    // Check if Ctrl+F or Cmd+F is pressed
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      // Prevent default browser search
      e.preventDefault();

      // Open search sidebar
      searchSidebar.classList.add('open');
      searchInput.focus();
    }

    // Close sidebar with Escape key
    if (e.key === 'Escape' && searchSidebar.classList.contains('open')) {
      searchSidebar.classList.remove('open');
    }
  });
}

// Set up TLE modal functionality
function setupTLEModal(app) {
  // Get modal elements
  const modal = document.getElementById('tle-modal');
  const toggleBtn = document.getElementById('add-tle-toggle');
  const closeBtn = document.getElementById('tle-modal-close');
  const cancelBtn = document.getElementById('tle-cancel');
  const submitBtn = document.getElementById('tle-submit');
  const errorDiv = document.getElementById('tle-error');

  // Input fields
  const nameInput = document.getElementById('tle-name');
  const line1Input = document.getElementById('tle-line1');
  const line2Input = document.getElementById('tle-line2');
  const fullTLEInput = document.getElementById('tle-full');

  // Open modal
  toggleBtn.addEventListener('click', () => {
    modal.classList.add('open');
    nameInput.focus();
  });

  // Close modal functions
  function closeModal() {
    modal.classList.remove('open');
    clearForm();
  }

  function clearForm() {
    nameInput.value = '';
    line1Input.value = '';
    line2Input.value = '';
    fullTLEInput.value = '';
    errorDiv.classList.remove('visible');
    errorDiv.textContent = '';
  }

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.add('visible');
  }

  // Close button handlers
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });

  // Auto-fill from full TLE textarea
  fullTLEInput.addEventListener('input', () => {
    const fullText = fullTLEInput.value;
    if (fullText.trim()) {
      const parsed = app.parseTLEString(fullText);
      if (parsed.success) {
        if (parsed.name) {
          nameInput.value = parsed.name;
        }
        line1Input.value = parsed.tle1;
        line2Input.value = parsed.tle2;
      }
    }
  });

  // Submit handler
  submitBtn.addEventListener('click', () => {
    // Hide previous error
    errorDiv.classList.remove('visible');

    // Get values - prefer individual fields, but check full TLE if those are empty
    let name = nameInput.value.trim();
    let tle1 = line1Input.value.trim();
    let tle2 = line2Input.value.trim();

    // If individual fields are empty, try to parse from full TLE
    if ((!tle1 || !tle2) && fullTLEInput.value.trim()) {
      const parsed = app.parseTLEString(fullTLEInput.value);
      if (parsed.success) {
        if (!name && parsed.name) name = parsed.name;
        if (!tle1) tle1 = parsed.tle1;
        if (!tle2) tle2 = parsed.tle2;
      } else {
        showError(parsed.message);
        return;
      }
    }

    // Attempt to add the satellite
    const result = app.addCustomTLE(name, tle1, tle2);

    if (result.success) {
      // Success - close modal and optionally select the new satellite
      closeModal();

      // Auto-select the new satellite
      if (result.satellite) {
        app.selectedObject = result.satellite;
        app.updateSelectedInfo();
      }
    } else {
      showError(result.message);
    }
  });

  // Allow Enter key to submit from text inputs (not textarea)
  [nameInput, line1Input, line2Input].forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitBtn.click();
      }
    });
  });
}

// Set up keyboard shortcuts
function setupKeyboardShortcuts(app) {
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    switch (e.key.toLowerCase()) {
      case ' ': // Space - Toggle pause
        e.preventDefault();
        app.toggleTimePause();
        break;

      case 'r': // R - Reset camera
        app.resetCamera();
        break;

      case 's': // S - Toggle satellites
        const satCheckbox = document.getElementById('toggle-satellites');
        satCheckbox.checked = !satCheckbox.checked;
        app.toggleSatellites(satCheckbox.checked);
        break;

      case 'o': // O - Toggle orbits (for selected satellite)
        const orbitCheckbox = document.getElementById('toggle-orbit-selected');
        orbitCheckbox.checked = !orbitCheckbox.checked;
        app.toggleOrbits(orbitCheckbox.checked);
        break;

      case 'g': // G - Toggle ground stations
        const gsCheckbox = document.getElementById('toggle-groundstations');
        gsCheckbox.checked = !gsCheckbox.checked;
        app.toggleGroundStations(gsCheckbox.checked);
        break;

      case 'l': // L - Toggle line of sight (for selected satellite)
        const losCheckbox = document.getElementById('toggle-los-selected');
        losCheckbox.checked = !losCheckbox.checked;
        app.toggleLineOfSight(losCheckbox.checked);
        break;

      case '+':
      case '=': // + or = - Speed up time
        app.speedUp();
        break;

      case '-': // - Slow down time
        app.slowDown();
        break;

      case 'escape': // Escape - Deselect object (if search sidebar is closed)
        const searchSidebar = document.getElementById('search-sidebar');
        if (!searchSidebar.classList.contains('open')) {
          app.deselectObject();
        }
        break;
    }
  });
}

// Set up walkthrough / onboarding tutorial
function setupWalkthrough() {
  const walkthrough = new Walkthrough();
  const helpBtn = document.getElementById('help-btn');

  // Bind Help button to restart walkthrough
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      walkthrough.start();
    });
  }

  // Handle window resize for walkthrough positioning
  window.addEventListener('resize', () => {
    walkthrough.handleResize();
  });

  // Auto-start walkthrough for first-time visitors
  if (!walkthrough.hasSeenWalkthrough()) {
    // Slight delay to let the app fully initialize
    setTimeout(() => {
      walkthrough.start();
    }, 1000);
  }
}
