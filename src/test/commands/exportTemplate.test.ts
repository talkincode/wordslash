// Tests for export template functionality

import { describe, it, expect } from 'vitest';
import type { BulkImportTemplate } from '../../storage/schema';

describe('exportTemplate', () => {
  describe('Template structure', () => {
    it('should have correct version and structure', () => {
      const template: BulkImportTemplate = {
        version: 1,
        cards: [],
      };

      expect(template.version).toBe(1);
      expect(Array.isArray(template.cards)).toBe(true);
    });

    it('should support sample card data', () => {
      const template: BulkImportTemplate = {
        version: 1,
        cards: [
          {
            term: 'ephemeral',
            type: 'word',
            phonetic: '/ɪˈfem.ər.əl/',
            translation: '短暂的；瞬息的',
            explanation: 'Lasting for a very short time',
            explanationCn: '持续时间非常短的',
            example: 'The ephemeral beauty of cherry blossoms',
            exampleCn: '樱花短暂的美丽',
            synonyms: ['transient', 'fleeting', 'temporary'],
            antonyms: ['permanent', 'eternal', 'lasting'],
            tags: ['vocabulary', 'advanced'],
          },
        ],
      };

      expect(template.cards).toHaveLength(1);
      const card = template.cards[0];
      expect(card.term).toBe('ephemeral');
      expect(card.type).toBe('word');
      expect(card.synonyms).toContain('transient');
      expect(card.antonyms).toContain('permanent');
      expect(card.tags).toContain('vocabulary');
    });

    it('should support minimal card data', () => {
      const template: BulkImportTemplate = {
        version: 1,
        cards: [
          {
            term: 'test',
          },
        ],
      };

      expect(template.cards[0].term).toBe('test');
      expect(template.cards[0].type).toBeUndefined();
      expect(template.cards[0].translation).toBeUndefined();
    });

    it('should support batch import', () => {
      const template: BulkImportTemplate = {
        version: 1,
        cards: [{ term: 'word1' }, { term: 'word2' }, { term: 'word3' }],
      };

      expect(template.cards).toHaveLength(3);
      expect(template.cards.map((c) => c.term)).toEqual(['word1', 'word2', 'word3']);
    });
  });
});
