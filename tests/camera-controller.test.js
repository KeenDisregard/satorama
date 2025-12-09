import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Three.js Vector3
class MockVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  clone() { return new MockVector3(this.x, this.y, this.z); }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  normalize() {
    const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (len > 0) { this.x /= len; this.y /= len; this.z /= len; }
    return this;
  }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
}

// Mock Three.js and Satellite
vi.mock('three', () => ({
  Vector3: MockVector3
}));

vi.mock('../src/components/satellite.js', () => ({
  default: class Satellite {}
}));

// Import after mocking
const { default: CameraController } = await import('../src/components/camera-controller.js');
const { default: Satellite } = await import('../src/components/satellite.js');

describe('CameraController', () => {
  let cameraController;
  let mockCamera;
  let mockControls;

  beforeEach(() => {
    mockCamera = {
      position: new MockVector3(0, 0, 20000),
      lookAt: vi.fn()
    };
    mockControls = {
      enabled: true,
      target: new MockVector3(),
      update: vi.fn()
    };
    cameraController = new CameraController(mockCamera, mockControls);
  });

  describe('initialization', () => {
    it('should store camera and controls references', () => {
      expect(cameraController.camera).toBe(mockCamera);
      expect(cameraController.controls).toBe(mockControls);
    });

    it('should initialize with no follow target', () => {
      expect(cameraController.followTarget).toBeNull();
    });

    it('should not be following initially', () => {
      expect(cameraController.isFollowing()).toBe(false);
    });
  });

  describe('toggleFollow', () => {
    const mockTarget = {
      mesh: { position: new MockVector3(100, 200, 300) }
    };

    it('should start following when given a target', () => {
      const result = cameraController.toggleFollow(mockTarget);
      expect(result).toBe(true);
      expect(cameraController.isFollowing()).toBe(true);
      expect(cameraController.getFollowTarget()).toBe(mockTarget);
    });

    it('should keep controls enabled when following (for orbiting around target)', () => {
      cameraController.toggleFollow(mockTarget);
      expect(mockControls.enabled).toBe(true);
    });

    it('should stop following when toggling same target', () => {
      cameraController.toggleFollow(mockTarget);
      const result = cameraController.toggleFollow(mockTarget);
      expect(result).toBe(false);
      expect(cameraController.isFollowing()).toBe(false);
    });

    it('should leave controls enabled when stopping follow', () => {
      cameraController.toggleFollow(mockTarget);
      cameraController.toggleFollow(mockTarget);
      expect(mockControls.enabled).toBe(true);
    });

    it('should return false when given null target', () => {
      const result = cameraController.toggleFollow(null);
      expect(result).toBe(false);
    });
  });

  describe('getTargetPosition', () => {
    it('should return mesh position for object with mesh', () => {
      const mockTarget = {
        mesh: { position: { x: 100, y: 200, z: 300 } }
      };
      const position = cameraController.getTargetPosition(mockTarget);
      expect(position).toEqual({ x: 100, y: 200, z: 300 });
    });

    it('should return zero vector for null target', () => {
      const position = cameraController.getTargetPosition(null);
      expect(position.x).toBe(0);
      expect(position.y).toBe(0);
      expect(position.z).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear follow target', () => {
      const mockTarget = { mesh: { position: new MockVector3(100, 200, 300) } };
      cameraController.toggleFollow(mockTarget);
      
      cameraController.reset();
      
      expect(cameraController.followTarget).toBeNull();
    });

    it('should re-enable controls', () => {
      mockControls.enabled = false;
      cameraController.reset();
      expect(mockControls.enabled).toBe(true);
    });
  });

  describe('isFollowing', () => {
    it('should return false when not following', () => {
      expect(cameraController.isFollowing()).toBe(false);
    });

    it('should return true when following a target', () => {
      const mockTarget = { mesh: { position: new MockVector3(0, 0, 0) } };
      cameraController.toggleFollow(mockTarget);
      expect(cameraController.isFollowing()).toBe(true);
    });
  });

  describe('getFollowTarget', () => {
    it('should return null when not following', () => {
      expect(cameraController.getFollowTarget()).toBeNull();
    });

    it('should return the target when following', () => {
      const mockTarget = { mesh: { position: new MockVector3(0, 0, 0) } };
      cameraController.toggleFollow(mockTarget);
      expect(cameraController.getFollowTarget()).toBe(mockTarget);
    });
  });

  describe('update', () => {
    it('should be a no-op placeholder (actual follow animation is in App)', () => {
      const initialPosition = { ...mockCamera.position };
      cameraController.update();
      // update() is a no-op - actual follow animation handled in App.animate()
      expect(mockCamera.position.x).toBe(initialPosition.x);
    });
  });

  describe('zoomTo', () => {
    it('should do nothing when given null object', () => {
      cameraController.zoomTo(null);
      expect(mockControls.update).not.toHaveBeenCalled();
    });

    it('should update controls target to object position', () => {
      const mockObject = { mesh: { position: new MockVector3(1000, 2000, 3000) } };
      cameraController.zoomTo(mockObject);
      
      expect(mockControls.target.x).toBe(1000);
      expect(mockControls.target.y).toBe(2000);
      expect(mockControls.target.z).toBe(3000);
    });

    it('should call controls.update()', () => {
      const mockObject = { mesh: { position: new MockVector3(0, 0, 0) } };
      cameraController.zoomTo(mockObject);
      expect(mockControls.update).toHaveBeenCalled();
    });

    it('should re-enable controls after zoom', () => {
      const mockObject = { mesh: { position: new MockVector3(0, 0, 0) } };
      mockControls.enabled = true;
      
      cameraController.zoomTo(mockObject);
      
      expect(mockControls.enabled).toBe(true);
    });

    it('should use larger distance for satellites', () => {
      // Create a mock satellite instance
      const mockSatellite = Object.create(Satellite.prototype);
      mockSatellite.mesh = { position: new MockVector3(0, 0, 0) };
      
      cameraController.zoomTo(mockSatellite);
      
      // Satellite uses distance 2000, so camera should be offset by (2000, 2000, 2000)
      expect(mockCamera.position.x).toBe(2000);
      expect(mockCamera.position.y).toBe(2000);
      expect(mockCamera.position.z).toBe(2000);
    });

    it('should use smaller distance for non-satellites', () => {
      const mockGroundStation = { mesh: { position: new MockVector3(0, 0, 0) } };
      
      cameraController.zoomTo(mockGroundStation);
      
      // Ground station uses distance 1000
      expect(mockCamera.position.x).toBe(1000);
      expect(mockCamera.position.y).toBe(1000);
      expect(mockCamera.position.z).toBe(1000);
    });
  });
});
