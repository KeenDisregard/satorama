import * as THREE from 'three';
import { latLonToVector3 } from '../utils.js';

class GroundStation {
  constructor(data) {
    // Store ground station data
    this.name = data.name;
    this.lat = data.lat;
    this.lon = data.lon;
    
    // Set ground station parameters
    this.color = 0x00ff00; // Green color for ground stations
    this.stationSize = 20;
    this.visible = true;
  }
  
  add(scene, earthRadius) {
    // Calculate position on Earth's surface
    const position = latLonToVector3(this.lat, this.lon, earthRadius);
    
    // Create ground station geometry
    const geometry = new THREE.CylinderGeometry(this.stationSize/3, this.stationSize, this.stationSize*2, 8);
    
    // Create material
    const material = new THREE.MeshPhongMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 0.5
    });
    
    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    
    // Calculate normal at position on the sphere
    const normal = new THREE.Vector3(position.x, position.y, position.z).normalize();
    
    // Position mesh at ground station location
    this.mesh.position.set(position.x, position.y, position.z);
    
    // Orient mesh to point away from Earth's center
    this.mesh.lookAt(position.x * 2, position.y * 2, position.z * 2);
    
    // Add user data
    this.mesh.userData = {
      name: this.name,
      type: 'groundStation',
      lat: this.lat,
      lon: this.lon
    };
    
    // Store initial position for rotation
    this.initialPosition = {
      x: position.x,
      y: position.y,
      z: position.z
    };
    
    // Add to scene
    scene.add(this.mesh);
    
    // Add visibility cone (optional)
    this.createVisibilityCone(scene, position, normal, earthRadius);
  }
  
  createVisibilityCone(scene, position, normal, earthRadius) {
    // Create visibility cone
    const coneHeight = earthRadius * 0.5;
    const coneRadius = earthRadius * 0.3;
    const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 16, 1, true);
    
    // Create material with transparency
    const coneMaterial = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide
    });
    
    // Create mesh
    this.cone = new THREE.Mesh(coneGeometry, coneMaterial);
    
    // Position cone
    this.cone.position.set(position.x, position.y, position.z);
    
    // Orient cone to point away from Earth's center
    this.cone.lookAt(position.x * 2, position.y * 2, position.z * 2);
    
    // Move cone so base is at ground station
    this.cone.translateOnAxis(new THREE.Vector3(0, 1, 0), coneHeight/2);
    
    // Hide cone initially
    this.cone.visible = false;
    
    // Add to scene
    scene.add(this.cone);
  }
  
  // Update position based on Earth rotation
  updateWithEarthRotation(earthMesh) {
    if (!this.initialPosition) return;
    
    // Create a position vector
    const position = new THREE.Vector3(
      this.initialPosition.x,
      this.initialPosition.y,
      this.initialPosition.z
    );
    
    // Apply the same rotation as the Earth
    position.applyQuaternion(earthMesh.quaternion);
    
    // Update mesh position
    this.mesh.position.set(position.x, position.y, position.z);
    
    // Update mesh orientation to always point away from center
    this.mesh.lookAt(0, 0, 0);
    this.mesh.rotateX(Math.PI / 2);
    
    // Update cone position if it exists
    if (this.cone) {
      this.cone.position.set(position.x, position.y, position.z);
      this.cone.lookAt(0, 0, 0);
      this.cone.rotateX(Math.PI / 2);
    }
  }
  
  toggleVisibility(visible) {
    // Toggle ground station visibility
    this.visible = visible;
    this.mesh.visible = visible;
    if (this.cone) {
      this.cone.visible = visible;
    }
  }
  
  toggleVisibilityCone(visible) {
    // Toggle visibility cone
    if (this.cone) {
      this.cone.visible = visible && this.visible;
    }
  }
  
  getPosition() {
    return {
      x: this.mesh.position.x,
      y: this.mesh.position.y,
      z: this.mesh.position.z
    };
  }
}

export default GroundStation;
