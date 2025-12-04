// SM-2 Algorithm tests
// TDD: Comprehensive tests for the SM-2 spaced repetition algorithm

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ratingToQuality, calculateNextState, createInitialSrsState } from '../../srs/sm2';
import type { SrsState, ReviewRating } from '../../storage/schema';
import { MIN_REVIEW_INTERVAL_MS, MAX_INTERVAL_DAYS, MAX_EASE_FACTOR } from '../../common/constants';

describe('SM-2 Algorithm', () => {
  const DAY_MS = 86400000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ratingToQuality()', () => {
    it.each([
      ['again', 0],
      ['hard', 3],
      ['good', 4],
      ['easy', 5],
    ] as [ReviewRating, number][])('should map %s to quality %d', (rating, expected) => {
      expect(ratingToQuality(rating)).toBe(expected);
    });
  });

  describe('createInitialSrsState()', () => {
    it('should create initial state with default values', () => {
      const state = createInitialSrsState('card-123');

      expect(state.cardId).toBe('card-123');
      expect(state.dueAt).toBe(Date.now());
      expect(state.intervalDays).toBe(0);
      expect(state.easeFactor).toBe(2.5);
      expect(state.reps).toBe(0);
      expect(state.lapses).toBe(0);
    });
  });

  describe('calculateNextState()', () => {
    const initialState: SrsState = {
      cardId: 'test',
      dueAt: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      reps: 0,
      lapses: 0,
    };

    describe('first review', () => {
      it('should set interval to 1 day on first "good"', () => {
        const now = Date.now();
        const next = calculateNextState(initialState, 'good', now);

        expect(next.intervalDays).toBe(1);
        expect(next.reps).toBe(1);
        expect(next.dueAt).toBe(now + DAY_MS);
      });

      it('should set interval to 1 day on first "easy"', () => {
        const now = Date.now();
        const next = calculateNextState(initialState, 'easy', now);

        expect(next.intervalDays).toBe(1);
        expect(next.reps).toBe(1);
      });

      it('should set interval to 1 day on first "hard"', () => {
        const now = Date.now();
        const next = calculateNextState(initialState, 'hard', now);

        expect(next.intervalDays).toBe(1);
        expect(next.reps).toBe(1);
      });

      it('should set interval to 1 day on "again" and increment lapses', () => {
        const now = Date.now();
        const next = calculateNextState(initialState, 'again', now);

        expect(next.intervalDays).toBe(1);
        expect(next.reps).toBe(0);
        expect(next.lapses).toBe(1);
      });

      it('should set lastReviewAt', () => {
        const now = Date.now();
        const next = calculateNextState(initialState, 'good', now);

        expect(next.lastReviewAt).toBe(now);
      });
    });

    describe('second review', () => {
      const afterFirstReview: SrsState = {
        ...initialState,
        reps: 1,
        intervalDays: 1,
      };

      it('should set interval to 6 days on second "good"', () => {
        const now = Date.now();
        const next = calculateNextState(afterFirstReview, 'good', now);

        expect(next.intervalDays).toBe(6);
        expect(next.reps).toBe(2);
        expect(next.dueAt).toBe(now + 6 * DAY_MS);
      });

      it('should reset on "again" after first review', () => {
        const now = Date.now();
        const next = calculateNextState(afterFirstReview, 'again', now);

        expect(next.intervalDays).toBe(1);
        expect(next.reps).toBe(0);
        expect(next.lapses).toBe(1);
      });
    });

    describe('third+ review', () => {
      const afterSecondReview: SrsState = {
        ...initialState,
        reps: 2,
        intervalDays: 6,
        easeFactor: 2.5,
      };

      it('should multiply interval by EF on "good"', () => {
        const now = Date.now();
        const next = calculateNextState(afterSecondReview, 'good', now);

        expect(next.intervalDays).toBe(Math.round(6 * 2.5)); // 15
        expect(next.reps).toBe(3);
      });

      it('should multiply interval by EF on "easy"', () => {
        const now = Date.now();
        const next = calculateNextState(afterSecondReview, 'easy', now);

        expect(next.intervalDays).toBe(Math.round(6 * afterSecondReview.easeFactor));
        expect(next.reps).toBe(3);
      });

      it('should adjust EF based on quality - easy increases EF', () => {
        const now = Date.now();
        const nextEasy = calculateNextState(afterSecondReview, 'easy', now);

        // easy (q=5): EF = 2.5 + (0.1 - 0 * (0.08 + 0 * 0.02)) = 2.6
        expect(nextEasy.easeFactor).toBeGreaterThan(afterSecondReview.easeFactor);
      });

      it('should adjust EF based on quality - hard decreases EF', () => {
        const now = Date.now();
        const nextHard = calculateNextState(afterSecondReview, 'hard', now);

        // hard (q=3): EF = 2.5 + (0.1 - 2 * (0.08 + 2 * 0.02)) = 2.5 + 0.1 - 0.24 = 2.36
        expect(nextHard.easeFactor).toBeLessThan(afterSecondReview.easeFactor);
      });

      it('should reset on "again" during mature phase', () => {
        const now = Date.now();
        const matureState: SrsState = {
          ...afterSecondReview,
          reps: 5,
          intervalDays: 30,
        };

        const next = calculateNextState(matureState, 'again', now);

        expect(next.intervalDays).toBe(1);
        expect(next.reps).toBe(0);
        expect(next.lapses).toBe(1);
      });
    });

    describe('EF boundaries', () => {
      it('should not let EF drop below 1.3', () => {
        let state: SrsState = {
          ...initialState,
          reps: 3,
          intervalDays: 10,
          easeFactor: 1.4,
        };

        // Multiple hard reviews should decrease EF but not below 1.3
        for (let i = 0; i < 10; i++) {
          state = calculateNextState(state, 'hard', Date.now() + i * DAY_MS);
        }

        expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
      });

      it('should not let EF exceed MAX_EASE_FACTOR (3.0)', () => {
        let state: SrsState = {
          ...initialState,
          reps: 3,
          intervalDays: 10,
          easeFactor: 2.9,
        };

        // Multiple easy reviews should increase EF but not above MAX_EASE_FACTOR
        for (let i = 0; i < 10; i++) {
          state = calculateNextState(state, 'easy', Date.now() + i * DAY_MS);
        }

        expect(state.easeFactor).toBeLessThanOrEqual(MAX_EASE_FACTOR);
      });

      it('should not reset EF on "again"', () => {
        const state: SrsState = {
          ...initialState,
          reps: 3,
          intervalDays: 10,
          easeFactor: 2.0,
        };

        const next = calculateNextState(state, 'again', Date.now());

        // EF should remain unchanged on "again"
        expect(next.easeFactor).toBe(2.0);
      });
    });

    describe('dueAt calculation', () => {
      it('should set dueAt to reviewTime + intervalDays * DAY_MS', () => {
        const now = Date.now();
        const next = calculateNextState(initialState, 'good', now);

        const expectedDue = now + next.intervalDays * DAY_MS;
        expect(next.dueAt).toBe(expectedDue);
      });

      it('should use provided reviewTime, not current time', () => {
        const reviewTime = Date.now() - 1000000;
        const next = calculateNextState(initialState, 'good', reviewTime);

        expect(next.dueAt).toBe(reviewTime + next.intervalDays * DAY_MS);
        expect(next.lastReviewAt).toBe(reviewTime);
      });
    });

    describe('lapses accumulation', () => {
      it('should accumulate lapses on multiple "again" ratings', () => {
        let state = initialState;

        state = calculateNextState(state, 'again', Date.now());
        expect(state.lapses).toBe(1);

        state = calculateNextState(state, 'good', Date.now());
        state = calculateNextState(state, 'again', Date.now());
        expect(state.lapses).toBe(2);

        state = calculateNextState(state, 'good', Date.now());
        state = calculateNextState(state, 'again', Date.now());
        expect(state.lapses).toBe(3);
      });
    });
  });

  describe('integration: review sequences', () => {
    const initialState: SrsState = {
      cardId: 'test',
      dueAt: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      reps: 0,
      lapses: 0,
    };

    it('should follow expected intervals for perfect "good" reviews', () => {
      let state = initialState;
      const now = Date.now();

      // Perfect sequence: good, good, good, good
      const expectedIntervals = [1, 6, 15, 38]; // Approximately

      expectedIntervals.forEach((expected, i) => {
        state = calculateNextState(state, 'good', now + i * DAY_MS * expected);
        expect(state.intervalDays).toBeCloseTo(expected, 0);
      });
    });

    it('should recover after a lapse', () => {
      let state = initialState;
      const now = Date.now();

      // Build up some progress
      state = calculateNextState(state, 'good', now);
      state = calculateNextState(state, 'good', now + DAY_MS);
      state = calculateNextState(state, 'good', now + 7 * DAY_MS);

      expect(state.reps).toBe(3);
      expect(state.intervalDays).toBe(15);

      // Lapse
      state = calculateNextState(state, 'again', now + 22 * DAY_MS);

      expect(state.reps).toBe(0);
      expect(state.intervalDays).toBe(1);
      expect(state.lapses).toBe(1);

      // Recover
      state = calculateNextState(state, 'good', now + 23 * DAY_MS);
      expect(state.reps).toBe(1);
      expect(state.intervalDays).toBe(1);
    });

    it('should handle mixed rating sequence', () => {
      let state = initialState;
      const now = Date.now();

      state = calculateNextState(state, 'good', now);
      expect(state.intervalDays).toBe(1);

      state = calculateNextState(state, 'hard', now + DAY_MS);
      expect(state.intervalDays).toBe(6);
      expect(state.easeFactor).toBeLessThan(2.5);

      state = calculateNextState(state, 'easy', now + 7 * DAY_MS);
      expect(state.reps).toBe(3);
      // EF should have increased from the easy rating
    });
  });

  describe('consolidation reviews (Loop mode protection)', () => {
    const reviewedState: SrsState = {
      cardId: 'test',
      dueAt: 0,
      intervalDays: 6,
      easeFactor: 2.5,
      reps: 2,
      lapses: 0,
      lastReviewAt: Date.now(),
    };

    it('should not update interval/reps for reviews within MIN_REVIEW_INTERVAL', () => {
      const now = Date.now();
      const state = { ...reviewedState, lastReviewAt: now };
      
      // Review again after just 30 minutes (within 1 hour)
      const next = calculateNextState(state, 'good', now + 30 * 60 * 1000);

      expect(next.reps).toBe(2); // Unchanged
      expect(next.intervalDays).toBe(6); // Unchanged
      expect(next.easeFactor).toBe(2.5); // Unchanged
    });

    it('should update normally after MIN_REVIEW_INTERVAL has passed', () => {
      const now = Date.now();
      const state = { ...reviewedState, lastReviewAt: now };
      
      // Review after 2 hours (beyond MIN_REVIEW_INTERVAL)
      const next = calculateNextState(state, 'good', now + 2 * 60 * 60 * 1000);

      expect(next.reps).toBe(3); // Incremented
      expect(next.intervalDays).toBe(15); // 6 * 2.5 = 15
    });

    it('should still reset on "again" even in consolidation window', () => {
      const now = Date.now();
      const state = { ...reviewedState, lastReviewAt: now };
      
      // "again" should always reset, even if within MIN_REVIEW_INTERVAL
      const next = calculateNextState(state, 'again', now + 30 * 60 * 1000);

      expect(next.reps).toBe(0);
      expect(next.intervalDays).toBe(1);
      expect(next.lapses).toBe(1);
    });

    it('should allow first review even without lastReviewAt', () => {
      const now = Date.now();
      const newCard: SrsState = {
        cardId: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
        // No lastReviewAt
      };
      
      const next = calculateNextState(newCard, 'good', now);

      expect(next.reps).toBe(1);
      expect(next.intervalDays).toBe(1);
    });
  });

  describe('interval cap', () => {
    it('should not let interval exceed MAX_INTERVAL_DAYS (365)', () => {
      let state: SrsState = {
        cardId: 'test',
        dueAt: 0,
        intervalDays: 200,
        easeFactor: 2.5,
        reps: 10,
        lapses: 0,
        lastReviewAt: 0,
      };

      const now = Date.now();
      // Review with enough time gap
      state = calculateNextState(state, 'good', now);

      // 200 * 2.5 = 500, but should be capped at 365
      expect(state.intervalDays).toBeLessThanOrEqual(MAX_INTERVAL_DAYS);
      expect(state.intervalDays).toBe(MAX_INTERVAL_DAYS);
    });
  });
});
