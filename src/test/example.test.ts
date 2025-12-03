// Example test to verify test framework is working
// This is a placeholder test for Phase 0

import { describe, it, expect } from 'vitest';

describe('Example Test Suite', () => {
  describe('Basic Math', () => {
    it('should add two numbers correctly', () => {
      expect(1 + 1).toBe(2);
    });

    it('should multiply two numbers correctly', () => {
      expect(2 * 3).toBe(6);
    });
  });

  describe('String Operations', () => {
    it('should concatenate strings', () => {
      expect('Hello' + ' ' + 'World').toBe('Hello World');
    });
  });

  describe('Array Operations', () => {
    it('should create an array with expected length', () => {
      const arr = [1, 2, 3, 4, 5];
      expect(arr).toHaveLength(5);
    });
  });
});
