// Scheduler tests
// TDD: Tests for card selection strategy with Ebbinghaus forgetting curve

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getNextCard, 
  getStats, 
  calculateRetention,
  calculatePriority,
  type SchedulerOptions 
} from '../../srs/scheduler';
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

  describe('loopMode', () => {
    it('should return any card when loopMode is enabled and no due/new cards', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([
          ['1', makeCard('1', 'card1')],
          ['2', makeCard('2', 'card2')],
        ]),
        srsStates: new Map([
          ['1', makeSrsState('1', now + DAY_MS, 1, 1)], // Due tomorrow
          ['2', makeSrsState('2', now + DAY_MS * 2, 2, 2)], // Due in 2 days
        ]),
        dueCards: ['1', '2'], // Sorted by dueAt
        newCards: [],
      };

      // Without loop mode - returns null
      const withoutLoop = getNextCard(index, now, { loopMode: false });
      expect(withoutLoop).toBeNull();

      // With loop mode - returns first card
      const withLoop = getNextCard(index, now, { loopMode: true });
      expect(withLoop?.id).toBe('1');
    });

    it('should exclude specified card in loop mode', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([
          ['1', makeCard('1', 'card1')],
          ['2', makeCard('2', 'card2')],
        ]),
        srsStates: new Map([
          ['1', makeSrsState('1', now + DAY_MS, 1, 1)],
          ['2', makeSrsState('2', now + DAY_MS * 2, 2, 2)],
        ]),
        dueCards: ['1', '2'],
        newCards: [],
      };

      const next = getNextCard(index, now, { 
        loopMode: true, 
        excludeCardId: '1' 
      });
      
      expect(next?.id).toBe('2');
    });

    it('should return null in loop mode if only excluded card exists', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([['1', makeCard('1', 'only')]]),
        srsStates: new Map([['1', makeSrsState('1', now + DAY_MS, 1, 1)]]),
        dueCards: ['1'],
        newCards: [],
      };

      const next = getNextCard(index, now, { 
        loopMode: true, 
        excludeCardId: '1' 
      });
      
      expect(next).toBeNull();
    });

    it('should prioritize due cards even in loop mode', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([
          ['due', makeCard('due', 'due-card')],
          ['future', makeCard('future', 'future-card')],
        ]),
        srsStates: new Map([
          ['due', makeSrsState('due', now - 1000, 1, 1)], // Actually due
          ['future', makeSrsState('future', now + DAY_MS, 2, 2)],
        ]),
        dueCards: ['due', 'future'],
        newCards: [],
      };

      const next = getNextCard(index, now, { loopMode: true });
      
      expect(next?.id).toBe('due');
    });

    it('should exclude card from due cards check', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([
          ['1', makeCard('1', 'card1')],
          ['2', makeCard('2', 'card2')],
        ]),
        srsStates: new Map([
          ['1', makeSrsState('1', now - 1000, 1, 1)], // Due
          ['2', makeSrsState('2', now - 500, 1, 1)], // Also due
        ]),
        dueCards: ['1', '2'],
        newCards: [],
      };

      const next = getNextCard(index, now, { excludeCardId: '1' });
      
      expect(next?.id).toBe('2');
    });

    it('should deprioritize recent cards', () => {
      const now = Date.now();
      const index: CardIndex = {
        cards: new Map([
          ['1', makeCard('1', 'card1')],
          ['2', makeCard('2', 'card2')],
          ['3', makeCard('3', 'card3')],
        ]),
        srsStates: new Map([
          ['1', makeSrsState('1', now - 1000, 1, 1)],
          ['2', makeSrsState('2', now - 1000, 1, 1)],
          ['3', makeSrsState('3', now - 1000, 1, 1)],
        ]),
        dueCards: ['1', '2', '3'],
        newCards: [],
      };

      // With '1' as most recent, should prefer other cards
      const next = getNextCard(index, now, { 
        recentCardIds: ['1', '2'] 
      });
      
      expect(next?.id).toBe('3');
    });
  });

  describe('calculateRetention()', () => {
    it('should return 0 for new cards', () => {
      const srs = makeSrsState('1', Date.now(), 0, 0);
      const retention = calculateRetention(srs, Date.now());
      expect(retention).toBe(0);
    });

    it('should return high retention for recently reviewed card', () => {
      const now = Date.now();
      // Card due in 1 day, interval is 1 day, so just reviewed
      const srs = makeSrsState('1', now + DAY_MS, 1, 1);
      const retention = calculateRetention(srs, now);
      expect(retention).toBeGreaterThan(0.9);
    });

    it('should return lower retention as time passes', () => {
      const now = Date.now();
      // Card was due yesterday (overdue by 1 day)
      const srs = makeSrsState('1', now - DAY_MS, 1, 1);
      const retention = calculateRetention(srs, now);
      expect(retention).toBeLessThan(0.5);
    });

    it('should have higher retention for longer intervals', () => {
      const now = Date.now();
      // Two cards overdue by same amount, but one has longer interval
      const shortInterval = makeSrsState('1', now - DAY_MS, 3, 3);
      const longInterval = makeSrsState('2', now - DAY_MS, 5, 10);
      
      const retentionShort = calculateRetention(shortInterval, now);
      const retentionLong = calculateRetention(longInterval, now);
      
      expect(retentionLong).toBeGreaterThan(retentionShort);
    });
  });

  describe('calculatePriority()', () => {
    it('should give high priority to overdue cards', () => {
      const now = Date.now();
      const overdue = makeSrsState('1', now - DAY_MS, 1, 1);
      const notDue = makeSrsState('2', now + DAY_MS, 1, 1);
      
      const priorityOverdue = calculatePriority(overdue, now);
      const priorityNotDue = calculatePriority(notDue, now);
      
      expect(priorityOverdue).toBeGreaterThan(priorityNotDue);
    });

    it('should give higher priority to cards with more lapses', () => {
      const now = Date.now();
      const fewLapses = { ...makeSrsState('1', now - 1000, 1, 1), lapses: 1 };
      const manyLapses = { ...makeSrsState('2', now - 1000, 1, 1), lapses: 5 };
      
      const priorityFew = calculatePriority(fewLapses, now);
      const priorityMany = calculatePriority(manyLapses, now);
      
      expect(priorityMany).toBeGreaterThan(priorityFew);
    });

    it('should penalize recently reviewed cards', () => {
      const now = Date.now();
      const srs = makeSrsState('1', now - 1000, 1, 1);
      
      const priorityNormal = calculatePriority(srs, now, []);
      const priorityRecent = calculatePriority(srs, now, ['1']);
      
      expect(priorityRecent).toBeLessThan(priorityNormal);
    });

    it('should give higher priority to cards with low ease factor', () => {
      const now = Date.now();
      const highEase = { ...makeSrsState('1', now - 1000, 1, 1), easeFactor: 2.5 };
      const lowEase = { ...makeSrsState('2', now - 1000, 1, 1), easeFactor: 1.5 };
      
      const priorityHigh = calculatePriority(highEase, now);
      const priorityLow = calculatePriority(lowEase, now);
      
      expect(priorityLow).toBeGreaterThan(priorityHigh);
    });
  });
});
