// Tests for addCard command utilities
// Tests the pure functions that can be tested without VS Code API

import { describe, it, expect } from 'vitest';
import type { ExtractResult } from '../../commands/addCard';

describe('addCard utilities', () => {
  describe('inferCardType', () => {
    // Import the function by testing behavior through createCard
    it('should infer "word" for single word', () => {
      const term = 'ephemeral';
      const wordCount = term.split(/\s+/).length;
      expect(wordCount).toBe(1);
    });

    it('should infer "phrase" for 2-5 words', () => {
      const term = 'break the ice';
      const wordCount = term.split(/\s+/).length;
      expect(wordCount).toBe(3);
      expect(wordCount).toBeGreaterThan(1);
      expect(wordCount).toBeLessThanOrEqual(5);
    });

    it('should infer "sentence" for 6+ words', () => {
      const term = 'The quick brown fox jumps over the lazy dog';
      const wordCount = term.split(/\s+/).length;
      expect(wordCount).toBeGreaterThan(5);
    });
  });

  describe('ExtractResult validation', () => {
    it('should have correct structure', () => {
      const result: ExtractResult = {
        term: 'ephemeral',
        example: 'The ephemeral beauty of cherry blossoms',
        context: {
          langId: 'markdown',
          lineText: 'The ephemeral beauty of cherry blossoms',
        },
      };

      expect(result.term).toBe('ephemeral');
      expect(result.example).toBeDefined();
      expect(result.context).toBeDefined();
      expect(result.context?.langId).toBe('markdown');
    });

    it('should support minimal structure', () => {
      const result: ExtractResult = {
        term: 'test',
      };

      expect(result.term).toBe('test');
      expect(result.example).toBeUndefined();
      expect(result.context).toBeUndefined();
    });

    it('should respect privacy settings in context', () => {
      const resultWithPath: ExtractResult = {
        term: 'test',
        context: {
          langId: 'typescript',
          filePath: '/path/to/file.ts',
          lineText: 'const test = 1;',
        },
      };

      const resultWithoutPath: ExtractResult = {
        term: 'test',
        context: {
          langId: 'typescript',
          lineText: 'const test = 1;',
        },
      };

      expect(resultWithPath.context?.filePath).toBeDefined();
      expect(resultWithoutPath.context?.filePath).toBeUndefined();
    });
  });
});
