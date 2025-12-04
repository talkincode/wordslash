// Tests for common constants

import { describe, it, expect } from 'vitest';
import {
  DAY_MS,
  HOUR_MS,
  MATURE_INTERVAL_DAYS,
  INITIAL_EASE_FACTOR,
  MIN_EASE_FACTOR,
  MAX_EASE_FACTOR,
  MAX_INTERVAL_DAYS,
  MIN_REVIEW_INTERVAL_MS,
  MAX_RECENT_CARDS,
  DEFAULT_NEW_CARDS_PER_DAY,
  DEFAULT_MAX_NODES,
  INDEXER_VERSION,
  CARDS_FILE,
  EVENTS_FILE,
  INDEX_FILE,
} from '../../common/constants';

describe('Constants', () => {
  describe('Time constants', () => {
    it('should have correct DAY_MS value', () => {
      expect(DAY_MS).toBe(24 * 60 * 60 * 1000);
      expect(DAY_MS).toBe(86400000);
    });

    it('should have correct HOUR_MS value', () => {
      expect(HOUR_MS).toBe(60 * 60 * 1000);
      expect(HOUR_MS).toBe(3600000);
    });
  });

  describe('SRS constants', () => {
    it('should have correct MATURE_INTERVAL_DAYS', () => {
      expect(MATURE_INTERVAL_DAYS).toBe(21);
    });

    it('should have correct INITIAL_EASE_FACTOR', () => {
      expect(INITIAL_EASE_FACTOR).toBe(2.5);
    });

    it('should have correct MIN_EASE_FACTOR', () => {
      expect(MIN_EASE_FACTOR).toBe(1.3);
    });

    it('should have correct MAX_EASE_FACTOR', () => {
      expect(MAX_EASE_FACTOR).toBe(3.0);
    });

    it('should have valid ease factor range', () => {
      expect(MIN_EASE_FACTOR).toBeLessThan(INITIAL_EASE_FACTOR);
      expect(INITIAL_EASE_FACTOR).toBeLessThan(MAX_EASE_FACTOR);
    });

    it('should have correct MAX_INTERVAL_DAYS', () => {
      expect(MAX_INTERVAL_DAYS).toBe(365);
    });

    it('should have correct MIN_REVIEW_INTERVAL_MS', () => {
      expect(MIN_REVIEW_INTERVAL_MS).toBe(HOUR_MS);
    });
  });

  describe('Scheduler constants', () => {
    it('should have reasonable MAX_RECENT_CARDS', () => {
      expect(MAX_RECENT_CARDS).toBeGreaterThan(0);
      expect(MAX_RECENT_CARDS).toBeLessThanOrEqual(10);
    });

    it('should have reasonable DEFAULT_NEW_CARDS_PER_DAY', () => {
      expect(DEFAULT_NEW_CARDS_PER_DAY).toBeGreaterThan(0);
      expect(DEFAULT_NEW_CARDS_PER_DAY).toBeLessThanOrEqual(100);
    });

    it('should have reasonable DEFAULT_MAX_NODES', () => {
      expect(DEFAULT_MAX_NODES).toBeGreaterThan(0);
    });
  });

  describe('Indexer constants', () => {
    it('should have correct INDEXER_VERSION', () => {
      expect(INDEXER_VERSION).toBe(1);
    });
  });

  describe('File names', () => {
    it('should have correct file names', () => {
      expect(CARDS_FILE).toBe('cards.jsonl');
      expect(EVENTS_FILE).toBe('events.jsonl');
      expect(INDEX_FILE).toBe('index.json');
    });

    it('should have unique file names', () => {
      const files = [CARDS_FILE, EVENTS_FILE, INDEX_FILE];
      const uniqueFiles = new Set(files);
      expect(uniqueFiles.size).toBe(files.length);
    });

    it('should have correct file extensions', () => {
      expect(CARDS_FILE.endsWith('.jsonl')).toBe(true);
      expect(EVENTS_FILE.endsWith('.jsonl')).toBe(true);
      expect(INDEX_FILE.endsWith('.json')).toBe(true);
    });
  });
});
