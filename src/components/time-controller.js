/**
 * TimeController - Manages simulation time and playback controls
 */
class TimeController {
  constructor() {
    this.current = new Date();
    this.multiplier = 1;
    this.lastFrameTime = performance.now();
    this.isPaused = false;
  }

  /**
   * Update simulation time based on elapsed real time and multiplier
   * @returns {Date} The current simulation time
   */
  update() {
    if (this.isPaused) {
      this.lastFrameTime = performance.now();
      return this.current;
    }

    const now = performance.now();
    const deltaTime = (now - this.lastFrameTime) / 1000; // seconds
    this.lastFrameTime = now;

    // Advance simulation time by delta * multiplier
    const timeAdvance = deltaTime * this.multiplier * 1000; // milliseconds
    this.current = new Date(this.current.getTime() + timeAdvance);

    return this.current;
  }

  /**
   * Get the time delta in seconds, scaled by the multiplier
   * @returns {number} Scaled time delta in seconds (0 when paused)
   */
  getScaledDelta() {
    if (this.isPaused) {
      return 0;
    }
    const now = performance.now();
    const deltaTime = (now - this.lastFrameTime) / 1000;
    return deltaTime * this.multiplier;
  }

  /**
   * Set the time speed multiplier
   * @param {number} multiplier - Time acceleration factor (1 = real-time)
   */
  setSpeed(multiplier) {
    this.multiplier = multiplier;
    if (this.isPaused && multiplier !== 0) {
      this.isPaused = false;
    }
  }

  /**
   * Toggle pause state
   * @returns {boolean} New pause state
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  /**
   * Reset simulation time to current real time
   */
  reset() {
    this.current = new Date();
  }

  /**
   * Format the current simulation time for display
   * @returns {string} Formatted time string
   */
  getFormattedTime() {
    const options = {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    };
    return this.current.toLocaleString('en-US', options);
  }
}

export default TimeController;
