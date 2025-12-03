// SRS module - SM-2 algorithm implementation
// PURE MODULE: No vscode imports allowed

import type { ReviewRating, SrsState } from '../storage/schema';

/**
 * SM-2 Rating to quality mapping (fixed, do not change)
 * - again → quality=0 (reset: reps=0, interval=1, lapses++)
 * - hard  → quality=3
 * - good  → quality=4
 * - easy  → quality=5
 */
export function ratingToQuality(rating: ReviewRating): number {
  switch (rating) {
    case 'again':
      return 0;
    case 'hard':
      return 3;
    case 'good':
      return 4;
    case 'easy':
      return 5;
  }
}

/**
 * Initial SRS state for a new card
 */
export function createInitialSrsState(cardId: string): SrsState {
  return {
    cardId,
    dueAt: Date.now(),
    intervalDays: 0,
    easeFactor: 2.5,
    reps: 0,
    lapses: 0,
  };
}

const DAY_MS = 86400000; // 24 * 60 * 60 * 1000

/**
 * Calculate the next SRS state after a review.
 *
 * SM-2 Algorithm:
 * - quality < 3 (again): reset reps to 0, interval to 1 day, increment lapses
 * - quality >= 3: increment reps, calculate new interval based on EF
 *
 * Interval progression: 1 day → 6 days → interval × EF
 * EF formula: EF + (0.1 - (5-q)*(0.08+(5-q)*0.02)), minimum 1.3
 */
export function calculateNextState(
  current: SrsState,
  rating: ReviewRating,
  reviewTime: number
): SrsState {
  const quality = ratingToQuality(rating);

  let { reps, intervalDays, easeFactor, lapses } = current;

  if (quality < 3) {
    // Failed review - reset
    reps = 0;
    intervalDays = 1;
    lapses += 1;
  } else {
    // Successful review
    reps += 1;

    if (reps === 1) {
      intervalDays = 1;
    } else if (reps === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }

    // Update ease factor
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(1.3, easeFactor);
  }

  const dueAt = reviewTime + intervalDays * DAY_MS;

  return {
    cardId: current.cardId,
    dueAt,
    intervalDays,
    easeFactor,
    reps,
    lapses,
    lastReviewAt: reviewTime,
  };
}
