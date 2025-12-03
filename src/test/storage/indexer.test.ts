// Indexer tests
// TDD: Write tests first, then implement

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildIndex, getDueCards, getNewCards } from '../../storage/indexer';
import { createCard, createReviewEvent, type Card, type ReviewEvent } from '../../storage/schema';

describe('Indexer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('buildIndex()', () => {
    it('should build index from cards with latest versions', () => {
      const baseCard1 = createCard({ type: 'word', front: { term: 'a' } });
      const baseCard2 = createCard({ type: 'word', front: { term: 'b' } });

      const cards: Card[] = [
        { ...baseCard1, id: '1', version: 1, front: { term: 'a' } },
        { ...baseCard1, id: '1', version: 2, front: { term: 'a-updated' } },
        { ...baseCard2, id: '2', version: 1, front: { term: 'b' } },
      ];

      const index = buildIndex(cards, []);

      expect(index.cards.size).toBe(2);
      expect(index.cards.get('1')?.front.term).toBe('a-updated');
      expect(index.cards.get('2')?.front.term).toBe('b');
    });

    it('should exclude soft-deleted cards', () => {
      const baseCard1 = createCard({ type: 'word', front: { term: 'a' } });
      const baseCard2 = createCard({ type: 'word', front: { term: 'b' } });

      const cards: Card[] = [
        { ...baseCard1, id: '1', deleted: true },
        { ...baseCard2, id: '2' },
      ];

      const index = buildIndex(cards, []);

      expect(index.cards.size).toBe(1);
      expect(index.cards.has('1')).toBe(false);
      expect(index.cards.has('2')).toBe(true);
    });

    it('should handle deleted then restored cards (latest version wins)', () => {
      const baseCard = createCard({ type: 'word', front: { term: 'test' } });

      const cards: Card[] = [
        { ...baseCard, id: '1', version: 1, deleted: false },
        { ...baseCard, id: '1', version: 2, deleted: true },
        { ...baseCard, id: '1', version: 3, deleted: false }, // Restored
      ];

      const index = buildIndex(cards, []);

      expect(index.cards.size).toBe(1);
      expect(index.cards.get('1')?.deleted).toBeFalsy();
    });

    it('should compute SRS state from events for reviewed cards', () => {
      const baseCard = createCard({ type: 'word', front: { term: 'test' } });
      const cards: Card[] = [{ ...baseCard, id: '1' }];

      const baseEvent = createReviewEvent({ cardId: '1', rating: 'good', mode: 'flashcard' });
      const events: ReviewEvent[] = [
        { ...baseEvent, id: 'e1', ts: 1000 },
        { ...baseEvent, id: 'e2', ts: 2000 },
      ];

      const index = buildIndex(cards, events);

      const srs = index.srsStates.get('1');
      expect(srs).toBeDefined();
      expect(srs?.reps).toBe(2);
      expect(srs?.intervalDays).toBeGreaterThan(0);
    });

    it('should handle "again" rating resetting progress', () => {
      const baseCard = createCard({ type: 'word', front: { term: 'test' } });
      const cards: Card[] = [{ ...baseCard, id: '1' }];

      const events: ReviewEvent[] = [
        {
          ...createReviewEvent({ cardId: '1', rating: 'good', mode: 'flashcard' }),
          id: 'e1',
          ts: 1000,
        },
        {
          ...createReviewEvent({ cardId: '1', rating: 'good', mode: 'flashcard' }),
          id: 'e2',
          ts: 2000,
        },
        {
          ...createReviewEvent({ cardId: '1', rating: 'again', mode: 'flashcard' }),
          id: 'e3',
          ts: 3000,
        },
      ];

      const index = buildIndex(cards, events);

      const srs = index.srsStates.get('1');
      expect(srs?.reps).toBe(0);
      expect(srs?.lapses).toBe(1);
      expect(srs?.intervalDays).toBe(1);
    });

    it('should create initial SRS state for cards without events', () => {
      const baseCard = createCard({ type: 'word', front: { term: 'new' } });
      const cards: Card[] = [{ ...baseCard, id: '1' }];

      const index = buildIndex(cards, []);

      const srs = index.srsStates.get('1');
      expect(srs).toBeDefined();
      expect(srs?.reps).toBe(0);
      expect(srs?.intervalDays).toBe(0);
      expect(srs?.easeFactor).toBe(2.5);
    });

    it('should populate dueCards array with due card ids', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const baseCard1 = createCard({ type: 'word', front: { term: 'due' } });
      const baseCard2 = createCard({ type: 'word', front: { term: 'new' } });
      const cards: Card[] = [
        { ...baseCard1, id: '1', createdAt: now - 86400000 * 2 },
        { ...baseCard2, id: '2', createdAt: now },
      ];

      // Card 1 was reviewed 2 days ago with interval 1 day, so it's due
      const events: ReviewEvent[] = [
        {
          ...createReviewEvent({ cardId: '1', rating: 'good', mode: 'flashcard' }),
          id: 'e1',
          ts: now - 86400000 * 2,
        },
      ];

      const index = buildIndex(cards, events);

      // Card 1 should be due (past its interval)
      expect(index.dueCards).toContain('1');
    });

    it('should populate newCards array with unreviewed card ids', () => {
      const baseCard = createCard({ type: 'word', front: { term: 'new' } });
      const cards: Card[] = [{ ...baseCard, id: '1' }];

      const index = buildIndex(cards, []);

      expect(index.newCards).toContain('1');
    });
  });

  describe('getDueCards()', () => {
    it('should return cards with dueAt <= now sorted by dueAt', () => {
      const now = Date.now();
      const baseCard1 = createCard({ type: 'word', front: { term: 'due-later' } });
      const baseCard2 = createCard({ type: 'word', front: { term: 'due-earlier' } });

      const cards: Card[] = [
        { ...baseCard1, id: '1' },
        { ...baseCard2, id: '2' },
      ];

      // Build index with events that make both cards due
      const events: ReviewEvent[] = [
        {
          ...createReviewEvent({ cardId: '1', rating: 'good', mode: 'flashcard' }),
          id: 'e1',
          ts: now - 86400000 * 3,
        },
        {
          ...createReviewEvent({ cardId: '2', rating: 'good', mode: 'flashcard' }),
          id: 'e2',
          ts: now - 86400000 * 5,
        },
      ];

      const index = buildIndex(cards, events);
      const dueCards = getDueCards(index, now);

      expect(dueCards.length).toBeGreaterThan(0);
      // Should be sorted by dueAt (earliest first)
      if (dueCards.length >= 2) {
        const srs1 = index.srsStates.get(dueCards[0].id);
        const srs2 = index.srsStates.get(dueCards[1].id);
        if (srs1 && srs2) {
          expect(srs1.dueAt).toBeLessThanOrEqual(srs2.dueAt);
        }
      }
    });

    it('should not return cards that are not due yet', () => {
      const now = Date.now();
      const baseCard = createCard({ type: 'word', front: { term: 'not-due' } });
      const cards: Card[] = [{ ...baseCard, id: '1' }];

      // Card reviewed just now with interval 1 day, not due yet
      const events: ReviewEvent[] = [
        {
          ...createReviewEvent({ cardId: '1', rating: 'easy', mode: 'flashcard' }),
          id: 'e1',
          ts: now,
        },
      ];

      const index = buildIndex(cards, events);
      const dueCards = getDueCards(index, now);

      // The card should not be due yet (reviewed just now with future due date)
      const card1Due = dueCards.find((c) => c.id === '1');
      expect(card1Due).toBeUndefined();
    });
  });

  describe('getNewCards()', () => {
    it('should return cards that have never been reviewed', () => {
      const baseCard1 = createCard({ type: 'word', front: { term: 'new' } });
      const baseCard2 = createCard({ type: 'word', front: { term: 'reviewed' } });
      const cards: Card[] = [
        { ...baseCard1, id: '1' },
        { ...baseCard2, id: '2' },
      ];

      const events: ReviewEvent[] = [
        {
          ...createReviewEvent({ cardId: '2', rating: 'good', mode: 'flashcard' }),
          id: 'e1',
          ts: 1000,
        },
      ];

      const index = buildIndex(cards, events);
      const newCards = getNewCards(index);

      expect(newCards).toHaveLength(1);
      expect(newCards[0].id).toBe('1');
    });

    it('should return empty array when all cards have been reviewed', () => {
      const baseCard = createCard({ type: 'word', front: { term: 'reviewed' } });
      const cards: Card[] = [{ ...baseCard, id: '1' }];

      const events: ReviewEvent[] = [
        {
          ...createReviewEvent({ cardId: '1', rating: 'good', mode: 'flashcard' }),
          id: 'e1',
          ts: 1000,
        },
      ];

      const index = buildIndex(cards, events);
      const newCards = getNewCards(index);

      expect(newCards).toHaveLength(0);
    });

    it('should sort new cards by creation time (oldest first)', () => {
      const now = Date.now();
      const baseCard1 = createCard({ type: 'word', front: { term: 'newer' } });
      const baseCard2 = createCard({ type: 'word', front: { term: 'older' } });
      const cards: Card[] = [
        { ...baseCard1, id: '1', createdAt: now },
        { ...baseCard2, id: '2', createdAt: now - 86400000 },
      ];

      const index = buildIndex(cards, []);
      const newCards = getNewCards(index);

      expect(newCards).toHaveLength(2);
      expect(newCards[0].id).toBe('2'); // Older first
      expect(newCards[1].id).toBe('1');
    });
  });
});
