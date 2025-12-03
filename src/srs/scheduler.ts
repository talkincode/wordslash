// SRS module - Next card selection strategy
// PURE MODULE: No vscode imports allowed

import type { Card, CardIndex } from '../storage/schema';

export const SCHEDULER_VERSION = 1;

/**
 * Options for the scheduler
 */
export interface SchedulerOptions {
  /** Maximum new cards to learn per day */
  newCardsPerDay?: number;
  /** Number of new cards already learned today */
  todayNewCardCount?: number;
}

/**
 * Statistics about the card collection
 */
export interface SchedulerStats {
  total: number;
  due: number;
  newCards: number;
  learning: number;
  mature: number;
}

const MATURE_INTERVAL_DAYS = 21;

/**
 * Get the next card to review.
 *
 * Priority:
 * 1. Due cards (sorted by dueAt, earliest first)
 * 2. New cards (if under daily limit, sorted by createdAt)
 * 3. null if nothing to review
 */
export function getNextCard(
  index: CardIndex,
  now: number,
  options: SchedulerOptions = {}
): Card | null {
  const { newCardsPerDay = 20, todayNewCardCount = 0 } = options;

  // First try due cards
  for (const cardId of index.dueCards) {
    const card = index.cards.get(cardId);
    const srs = index.srsStates.get(cardId);

    if (card && srs && srs.dueAt <= now && srs.reps > 0) {
      return card;
    }
  }

  // Then try new cards if under limit
  if (todayNewCardCount < newCardsPerDay) {
    for (const cardId of index.newCards) {
      const card = index.cards.get(cardId);
      const srs = index.srsStates.get(cardId);

      if (card && srs && srs.reps === 0) {
        return card;
      }
    }
  }

  return null;
}

/**
 * Get statistics about the card collection
 */
export function getStats(index: CardIndex, now: number): SchedulerStats {
  let total = 0;
  let due = 0;
  let newCards = 0;
  let learning = 0;
  let mature = 0;

  for (const [cardId] of index.cards) {
    total++;

    const srs = index.srsStates.get(cardId);
    if (!srs) {
      newCards++;
      continue;
    }

    if (srs.reps === 0) {
      newCards++;
    } else if (srs.intervalDays >= MATURE_INTERVAL_DAYS) {
      mature++;
      if (srs.dueAt <= now) {
        due++;
      }
    } else {
      learning++;
      if (srs.dueAt <= now) {
        due++;
      }
    }
  }

  return {
    total,
    due,
    newCards,
    learning,
    mature,
  };
}
