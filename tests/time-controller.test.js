import { describe, it, expect, beforeEach, vi } from 'vitest';
import TimeController from '../src/components/time-controller.js';

describe('TimeController', () => {
  let timeController;

  beforeEach(() => {
    timeController = new TimeController();
  });

  describe('initialization', () => {
    it('should initialize with current date', () => {
      const now = new Date();
      expect(timeController.current.getTime()).toBeCloseTo(now.getTime(), -3);
    });

    it('should initialize with multiplier of 1', () => {
      expect(timeController.multiplier).toBe(1);
    });

    it('should not be paused initially', () => {
      expect(timeController.isPaused).toBe(false);
    });
  });

  describe('setSpeed', () => {
    it('should set the time multiplier', () => {
      timeController.setSpeed(10);
      expect(timeController.multiplier).toBe(10);
    });

    it('should accept negative multipliers for reverse time', () => {
      timeController.setSpeed(-5);
      expect(timeController.multiplier).toBe(-5);
    });

    it('should accept zero multiplier (frozen time)', () => {
      timeController.setSpeed(0);
      expect(timeController.multiplier).toBe(0);
    });

    it('should unpause when setting non-zero speed while paused', () => {
      timeController.isPaused = true;
      timeController.setSpeed(2);
      expect(timeController.isPaused).toBe(false);
    });

    it('should NOT unpause when setting zero speed while paused', () => {
      timeController.isPaused = true;
      timeController.setSpeed(0);
      expect(timeController.isPaused).toBe(true);
    });
  });

  describe('togglePause', () => {
    it('should toggle pause state from false to true', () => {
      const result = timeController.togglePause();
      expect(result).toBe(true);
      expect(timeController.isPaused).toBe(true);
    });

    it('should toggle pause state from true to false', () => {
      timeController.isPaused = true;
      const result = timeController.togglePause();
      expect(result).toBe(false);
      expect(timeController.isPaused).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset simulation time to current real time', () => {
      // Advance time artificially
      timeController.current = new Date(2000, 0, 1);
      
      timeController.reset();
      
      const now = new Date();
      expect(timeController.current.getTime()).toBeCloseTo(now.getTime(), -3);
    });
  });

  describe('update', () => {
    it('should not advance time when paused', () => {
      timeController.isPaused = true;
      const initialTime = timeController.current.getTime();
      
      timeController.update();
      
      expect(timeController.current.getTime()).toBe(initialTime);
    });

    it('should return current simulation time', () => {
      const result = timeController.update();
      expect(result).toBeInstanceOf(Date);
    });

    it('should advance time forward with positive multiplier', async () => {
      timeController.setSpeed(1000); // 1000x speed
      const initialTime = timeController.current.getTime();
      
      // Wait a small amount of real time
      await new Promise(resolve => setTimeout(resolve, 50));
      timeController.update();
      
      expect(timeController.current.getTime()).toBeGreaterThan(initialTime);
    });

    it('should move time backward with negative multiplier', async () => {
      timeController.setSpeed(-1000); // -1000x speed (reverse)
      const initialTime = timeController.current.getTime();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      timeController.update();
      
      expect(timeController.current.getTime()).toBeLessThan(initialTime);
    });
  });

  describe('getScaledDelta', () => {
    it('should return scaled time delta', () => {
      timeController.setSpeed(10);
      const delta = timeController.getScaledDelta();
      expect(typeof delta).toBe('number');
    });

    it('should return zero delta with zero multiplier', () => {
      timeController.setSpeed(0);
      const delta = timeController.getScaledDelta();
      expect(delta).toBe(0);
    });

    it('should return negative delta with negative multiplier', async () => {
      timeController.setSpeed(-10);
      await new Promise(resolve => setTimeout(resolve, 10));
      const delta = timeController.getScaledDelta();
      expect(delta).toBeLessThan(0);
    });
  });

  describe('getFormattedTime', () => {
    it('should return a formatted string', () => {
      const formatted = timeController.getFormattedTime();
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should include year, month, and day', () => {
      timeController.current = new Date(2025, 5, 15, 10, 30, 45);
      const formatted = timeController.getFormattedTime();
      expect(formatted).toContain('2025');
      expect(formatted).toContain('Jun');
      expect(formatted).toContain('15');
    });
  });
});
