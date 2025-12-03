// Scheduler tests
// TDD: Tests for card selection strategy

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNextCard, getStats, type SchedulerOptions } from '../../srs/scheduler';
import { createCard, type Card, type CardIndex, type SrsState } from '../../storage/schema';

describe('Scheduler', () => {
  const DAY_MS = 86400000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeCard(id: string, term: string): Card {
    const card = createCard({ type: 'word', front: { term } });
    return { ...card, id };
  }

  function makeSrsState(
    cardId: string,
    dueAt: number,
    reps: number = 1,
    intervalDays: number = 1
  ): SrsState {
    return {
      cardId,
      dueAt,
      intervalDays,
      easeFactor: 2.5,
      reps,
      lapses: 0,
    };
  }

  describe('getNextCard()', () => {
    it('should return due card with earliest dueAt first', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([
          ['1', makeCard('1', 'first')],
          ['2', makeCard('2', 'second')],
        ]),
        srsStates: new Map([
          ['1', makeSrsState('1', now - 1000)], // Due 1 second ago
          ['2', makeSrsState('2', now - 5000)], // Due 5 seconds ago (earlier)
        ]),
        dueCards: ['2', '1'], // Pre-sorted
        newCards: [],
      };

      const next = getNextCard(index, now);

      expect(next?.id).toBe('2'); // Earlier due first
    });

    it('should return new card if no due cards', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([['1', makeCard('1', 'new')]]),
        srsStates: new Map([['1', makeSrsState('1', now, 0, 0)]]), // reps=0 means new
        dueCards: [],
        newCards: ['1'],
      };

      const next = getNextCard(index, now);

      expect(next?.id).toBe('1');
    });

    it('should return null if no cards at all', () => {
      const index: CardIndex = {
        cards: new Map(),
        srsStates: new Map(),
        dueCards: [],
        newCards: [],
      };

      const next = getNextCard(index, Date.now());

      expect(next).toBeNull();
    });

    it('should return null if only future due cards and no new cards', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([['1', makeCard('1', 'future')]]),
        srsStates: new Map([['1', makeSrsState('1', now + DAY_MS)]]), // Due tomorrow
        dueCards: [], // Not in dueCards because not due yet
        newCards: [],
      };

      const next = getNextCard(index, now);

      expect(next).toBeNull();
    });

    it('should prioritize due cards over new cards', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([
          ['due', makeCard('due', 'due-card')],
          ['new', makeCard('new', 'new-card')],
        ]),
        srsStates: new Map([
          ['due', makeSrsState('due', now - 1000)],
          ['new', makeSrsState('new', now, 0, 0)],
        ]),
        dueCards: ['due'],
        newCards: ['new'],
      };

      const next = getNextCard(index, now);

      expect(next?.id).toBe('due');
    });

    it('should respect newCardsPerDay limit', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([['new', makeCard('new', 'new-card')]]),
        srsStates: new Map([['new', makeSrsState('new', now, 0, 0)]]),
        dueCards: [],
        newCards: ['new'],
      };

      const options: SchedulerOptions = {
        newCardsPerDay: 10,
        todayNewCardCount: 10, // Already at limit
      };

      const next = getNextCard(index, now, options);

      expect(next).toBeNull(); // New cards limit reached
    });

    it('should allow new cards if under limit', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([['new', makeCard('new', 'new-card')]]),
        srsStates: new Map([['new', makeSrsState('new', now, 0, 0)]]),
        dueCards: [],
        newCards: ['new'],
      };

      const options: SchedulerOptions = {
        newCardsPerDay: 10,
        todayNewCardCount: 5, // Under limit
      };

      const next = getNextCard(index, now, options);

      expect(next?.id).toBe('new');
    });

    it('should return new cards sorted by creation time (oldest first)', () => {
      const now = Date.now();
      const olderCard = { ...makeCard('older', 'older'), createdAt: now - DAY_MS };
      const newerCard = { ...makeCard('newer', 'newer'), createdAt: now };

      const index: CardIndex = {
        cards: new Map([
          ['newer', newerCard],
          ['older', olderCard],
        ]),
        srsStates: new Map([
          ['newer', makeSrsState('newer', now, 0, 0)],
          ['older', makeSrsState('older', now, 0, 0)],
        ]),
        dueCards: [],
        newCards: ['older', 'newer'], // Should be pre-sorted
      };

      const next = getNextCard(index, now);

      expect(next?.id).toBe('older');
    });
  });

  describe('getStats()', () => {
    it('should return correct counts for mixed cards', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([
          ['due', makeCard('due', 'due-card')],
          ['new', makeCard('new', 'new-card')],
          ['future', makeCard('future', 'future-card')],
        ]),
        srsStates: new Map([
          ['due', makeSrsState('due', now - 1000, 3, 6)], // Due, learning
          ['new', makeSrsState('new', now, 0, 0)], // New
          ['future', makeSrsState('future', now + DAY_MS * 30, 10, 30)], // Mature, not due
        ]),
        dueCards: ['due'],
        newCards: ['new'],
      };

      const stats = getStats(index, now);

      expect(stats.total).toBe(3);
      expect(stats.due).toBe(1);
      expect(stats.newCards).toBe(1);
    });

    it('should count mature cards (intervalDays >= 21)', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([
          ['mature', makeCard('mature', 'mature-card')],
          ['learning', makeCard('learning', 'learning-card')],
        ]),
        srsStates: new Map([
          ['mature', makeSrsState('mature', now + DAY_MS * 25, 8, 25)], // Mature
          ['learning', makeSrsState('learning', now + DAY_MS, 2, 6)], // Learning
        ]),
        dueCards: [],
        newCards: [],
      };

      const stats = getStats(index, now);

      expect(stats.mature).toBe(1);
      expect(stats.learning).toBe(1);
    });

    it('should return zeros for empty index', () => {
      const index: CardIndex = {
        cards: new Map(),
        srsStates: new Map(),
        dueCards: [],
        newCards: [],
      };

      const stats = getStats(index, Date.now());

      expect(stats.total).toBe(0);
      expect(stats.due).toBe(0);
      expect(stats.newCards).toBe(0);
      expect(stats.learning).toBe(0);
      expect(stats.mature).toBe(0);
    });

    it('should count new cards correctly', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([
          ['1', makeCard('1', 'new1')],
          ['2', makeCard('2', 'new2')],
          ['3', makeCard('3', 'reviewed')],
        ]),
        srsStates: new Map([
          ['1', makeSrsState('1', now, 0, 0)],
          ['2', makeSrsState('2', now, 0, 0)],
          ['3', makeSrsState('3', now + DAY_MS, 1, 1)],
        ]),
        dueCards: [],
        newCards: ['1', '2'],
      };

      const stats = getStats(index, now);

      expect(stats.newCards).toBe(2);
    });
  });
});
