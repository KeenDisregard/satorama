import * as THREE from 'three';
import { isSatelliteVisibleFromStation } from '../utils.js';

/**
 * LineOfSight - High-performance LOS rendering using InstancedMesh
 * 
 * Uses a single InstancedMesh with cylinder geometry to render all LOS lines
 * in a single draw call. Pre-allocates space for MAX_LINES and only renders
 * the actual visible count each frame.
 */
class LineOfSight {
  constructor(scene) {
    // Store scene reference
    this.scene = scene;
    
    // Earth radius for calculations
    this.earthRadius = 6371; // km
    
    // Flag for visibility
    this.visible = true;
    
    // Maximum LOS lines we can render (stations × visible satellites)
    // 10 stations × 500 visible sats = 5000 max
    this.MAX_LINES = 5000;
    
    // Current active line count
    this.activeLineCount = 0;
    
    // Shared geometry - unit cylinder with pivot at bottom
    this.geometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
    this.geometry.translate(0, 0.5, 0); // Pivot at bottom
    
    // Material for all LOS lines
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3
    });
    
    // Single InstancedMesh for all LOS lines
    this.instancedMesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      this.MAX_LINES
    );
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.count = 0; // Start with no visible instances
    this.scene.add(this.instancedMesh);
    
    // Reusable objects to avoid per-frame allocation
    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._scale = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._defaultUp = new THREE.Vector3(0, 1, 0);
    this._startVec = new THREE.Vector3();
    this._endVec = new THREE.Vector3();
    
    // Zero matrix for hidden instances
    this._zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  }
  
  update(groundStations, satellites) {
    // Reset line count
    this.activeLineCount = 0;
    
    // If not visible, hide all instances
    if (!this.visible) {
      this.instancedMesh.count = 0;
      return;
    }
    
    // Calculate and set instance matrices for visible LOS lines
    for (const station of groundStations) {
      const stationPos = station.getPosition();
      
      for (const sat of satellites) {
        // Skip if we've hit max capacity
        if (this.activeLineCount >= this.MAX_LINES) break;
        
        const satPos = {
          x: sat.mesh.position.x,
          y: sat.mesh.position.y,
          z: sat.mesh.position.z
        };
        
        // Check if satellite is visible from the ground station
        if (isSatelliteVisibleFromStation(stationPos, satPos, this.earthRadius)) {
          this.setLineInstance(this.activeLineCount, stationPos, satPos);
          this.activeLineCount++;
        }
      }
    }
    
    // Update instance count to only render active lines
    this.instancedMesh.count = this.activeLineCount;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
  
  /**
   * Set the matrix for a single LOS line instance
   */
  setLineInstance(index, stationPos, satellitePos) {
    // Set start and end positions
    this._startVec.set(stationPos.x, stationPos.y, stationPos.z);
    this._endVec.set(satellitePos.x, satellitePos.y, satellitePos.z);
    
    // Calculate distance (cylinder length)
    const distance = this._startVec.distanceTo(this._endVec);
    
    // Calculate direction and quaternion
    this._direction.subVectors(this._endVec, this._startVec).normalize();
    this._quaternion.setFromUnitVectors(this._defaultUp, this._direction);
    
    // Set position (start point) and scale (1, distance, 1)
    this._position.copy(this._startVec);
    this._scale.set(1, distance, 1);
    
    // Compose and set matrix
    this._matrix.compose(this._position, this._quaternion, this._scale);
    this.instancedMesh.setMatrixAt(index, this._matrix);
  }
  
  toggleVisibility(visible) {
    this.visible = visible;
    this.instancedMesh.visible = visible;
  }
  
  getVisibleSatellitesFor(groundStation, satellites) {
    // Get position of ground station
    const stationPos = groundStation.getPosition();
    
    // Count visible satellites
    let count = 0;
    
    for (const sat of satellites) {
      const satPos = {
        x: sat.mesh.position.x,
        y: sat.mesh.position.y,
        z: sat.mesh.position.z
      };
      
      // Check if satellite is visible
      if (isSatelliteVisibleFromStation(stationPos, satPos, this.earthRadius)) {
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Dispose all GPU resources
   */
  dispose() {
    this.scene.remove(this.instancedMesh);
    this.instancedMesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

export default LineOfSight;
