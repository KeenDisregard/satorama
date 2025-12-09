import * as THREE from 'three';
import Satellite from './satellite.js';

/**
 * CameraController - Manages camera following, zooming, and reset functionality
 * 
 * Note: The actual follow animation is handled in App.animate() using delta-based tracking.
 * This controller manages follow state and initial camera positioning.
 */
class CameraController {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.followTarget = null;
    this.defaultPosition = camera.position.clone();
  }

  /**
   * Get the position of a target object
   * @param {Object} target - Satellite or GroundStation object
   * @returns {THREE.Vector3} Position of the target
   */
  getTargetPosition(target) {
    if (target && target.mesh) {
      return target.mesh.position;
    }
    return new THREE.Vector3();
  }

  /**
   * Toggle following the specified object
   * @param {Object} target - Object to follow
   * @returns {boolean} Whether now following
   */
  toggleFollow(target) {
    if (this.followTarget === target) {
      // Stop following - keep camera where it is, don't snap to Earth center
      this.followTarget = null;
      return false;
    } else if (target) {
      // Start following
      this.followTarget = target;
      
      // Get target position
      const targetPos = this.getTargetPosition(target).clone();
      
      // Position camera OUTSIDE the orbit (away from Earth) so Earth is visible behind satellite
      const dirFromEarth = targetPos.clone().normalize();
      const initialOffset = dirFromEarth.multiplyScalar(3000);
      this.camera.position.copy(targetPos).add(initialOffset);
      
      // Point controls target at satellite
      this.controls.target.copy(targetPos);
      this.controls.update();
      
      return true;
    }
    return false;
  }

  /**
   * Update method - placeholder for compatibility
   * Actual follow animation is handled in App.animate()
   */
  update() {
    // Follow animation is handled in App.animate() using delta-based tracking
  }

  /**
   * Zoom camera to focus on an object
   * @param {Object} object - Object to zoom to
   */
  zoomTo(object) {
    if (!object) return;

    const position = this.getTargetPosition(object);

    // Disable controls temporarily
    this.controls.enabled = false;

    // Set target position at appropriate distance based on object type
    const distance = object instanceof Satellite ? 2000 : 1000;
    this.camera.position.copy(position).add(new THREE.Vector3(distance, distance, distance));

    // Point camera at object
    this.controls.target.copy(position);
    this.controls.update();

    // Re-enable controls
    this.controls.enabled = true;
  }

  /**
   * Reset camera to default position
   */
  reset() {
    this.followTarget = null;
    this.controls.enabled = true;

    this.camera.position.copy(this.defaultPosition);
    this.camera.lookAt(0, 0, 0);

    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /**
   * Check if currently following a target
   * @returns {boolean}
   */
  isFollowing() {
    return this.followTarget !== null;
  }

  /**
   * Get the current follow target
   * @returns {Object|null}
   */
  getFollowTarget() {
    return this.followTarget;
  }
}

export default CameraController;
