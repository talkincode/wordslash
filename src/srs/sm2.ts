// SRS module - SM-2 algorithm implementation
// PURE MODULE: No vscode imports allowed

import type { ReviewRating, SrsState } from '../storage/schema';
import {
  INITIAL_EASE_FACTOR,
  MIN_EASE_FACTOR,
  MAX_EASE_FACTOR,
  MAX_INTERVAL_DAYS,
  MIN_REVIEW_INTERVAL_MS,
  DAY_MS,
} from '../common/constants';

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
    easeFactor: INITIAL_EASE_FACTOR,
    reps: 0,
    lapses: 0,
  };
}

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

  const { lastReviewAt } = current;
  let { reps, intervalDays, easeFactor, lapses } = current;

  // Check if this is a "consolidation review" (too soon after last review)
  // In loop mode, don't update interval/reps for reviews within MIN_REVIEW_INTERVAL
  const timeSinceLastReview = lastReviewAt ? reviewTime - lastReviewAt : Infinity;
  const isConsolidationReview = timeSinceLastReview < MIN_REVIEW_INTERVAL_MS && reps > 0;

  if (quality < 3) {
    // Failed review - always reset (even in consolidation)
    reps = 0;
    intervalDays = 1;
    lapses += 1;
  } else if (!isConsolidationReview) {
    // Successful review - only update if not consolidation
    reps += 1;

    if (reps === 1) {
      intervalDays = 1;
    } else if (reps === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }

    // Cap interval to prevent runaway values
    intervalDays = Math.min(intervalDays, MAX_INTERVAL_DAYS);

    // Update ease factor with caps
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(MIN_EASE_FACTOR, Math.min(MAX_EASE_FACTOR, easeFactor));
  }
  // If consolidation review with quality >= 3, keep current interval/reps unchanged

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
