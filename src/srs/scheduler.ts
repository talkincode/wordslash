// SRS module - Next card selection strategy
// PURE MODULE: No vscode imports allowed
// Incorporates Ebbinghaus Forgetting Curve for optimal review timing

import type { Card, CardIndex, SrsState } from '../storage/schema';

export const SCHEDULER_VERSION = 2;

/**
 * Options for the scheduler
 */
export interface SchedulerOptions {
  /** Maximum new cards to learn per day */
  newCardsPerDay?: number;
  /** Number of new cards already learned today */
  todayNewCardCount?: number;
  /** Enable loop mode - continue with any card when no due cards */
  loopMode?: boolean;
  /** Card ID to exclude from selection (e.g., current card) */
  excludeCardId?: string;
  /** Recently reviewed card IDs to avoid immediate repetition */
  recentCardIds?: string[];
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

/**
 * Card with priority score for sorting
 */
interface ScoredCard {
  card: Card;
  srs: SrsState;
  priority: number;
}

const MATURE_INTERVAL_DAYS = 21;
const DAY_MS = 86400000;

/**
 * Calculate memory retention based on Ebbinghaus forgetting curve.
 * R = e^(-t/S) where:
 * - t = time since last review
 * - S = memory strength (based on interval and ease factor)
 * 
 * Returns a value between 0 and 1, where:
 * - 1 = perfect retention (just reviewed)
 * - 0 = completely forgotten
 */
export function calculateRetention(srs: SrsState, now: number): number {
  if (srs.reps === 0) {
    return 0; // New card, no retention yet
  }
  
  const lastReviewAt = srs.dueAt - srs.intervalDays * DAY_MS;
  const timeSinceReview = now - lastReviewAt;
  
  // Memory strength based on interval and ease factor
  // Longer intervals and higher ease = stronger memory
  const memoryStrength = srs.intervalDays * DAY_MS * (srs.easeFactor / 2.5);
  
  // Ebbinghaus formula: R = e^(-t/S)
  const retention = Math.exp(-timeSinceReview / memoryStrength);
  
  return Math.max(0, Math.min(1, retention));
}

/**
 * Calculate priority score for a card.
 * Higher score = should be reviewed sooner.
 * 
 * Factors:
 * 1. Overdue urgency (how much past due date)
 * 2. Retention level (lower retention = higher priority)
 * 3. Difficulty (more lapses = higher priority)
 * 4. Recency penalty (recently reviewed cards get lower priority)
 */
export function calculatePriority(
  srs: SrsState, 
  now: number,
  recentCardIds: string[] = []
): number {
  let priority = 0;
  
  // Special case: Learning cards (just reviewed 1-2 times, still fresh)
  // Give them medium-high priority for repetition in the same session
  if (srs.reps > 0 && srs.reps <= 2 && srs.intervalDays <= 1) {
    const timeSinceReview = now - (srs.lastReviewAt || srs.dueAt - srs.intervalDays * DAY_MS);
    const minutesSinceReview = timeSinceReview / 60000;
    
    // If reviewed within last 30 minutes, give it medium priority (40-60)
    // This allows for spaced repetition within the same study session
    if (minutesSinceReview < 30) {
      priority += 40 + (30 - minutesSinceReview); // 40-70 points
    } else {
      priority += 35; // Base priority for learning cards
    }
  }
  
  // 1. Overdue factor (0-100 points)
  // Cards past due get high priority
  const overdueMs = now - srs.dueAt;
  if (overdueMs > 0) {
    // Overdue: high priority, scales with how overdue
    const overdueDays = overdueMs / DAY_MS;
    priority += Math.min(100, 50 + overdueDays * 10);
  } else {
    // Not due yet: lower base priority
    const daysUntilDue = -overdueMs / DAY_MS;
    priority += Math.max(0, 30 - daysUntilDue * 5);
  }
  
  // 2. Retention factor (0-50 points)
  // Lower retention = higher priority (needs review before forgetting)
  const retention = calculateRetention(srs, now);
  // Optimal review is at ~90% retention, below that is urgent
  if (retention < 0.9) {
    priority += (0.9 - retention) * 50;
  }
  
  // 3. Difficulty factor (0-20 points)
  // Cards with more lapses need more attention
  priority += Math.min(20, srs.lapses * 4);
  
  // 4. Low ease factor bonus (0-15 points)
  // Difficult cards (low EF) should be reviewed more
  if (srs.easeFactor < 2.5) {
    priority += (2.5 - srs.easeFactor) * 10;
  }
  
  // 5. Recency penalty (-30 to 0 points)
  // Recently reviewed cards get lower priority to add variety
  const recentIndex = recentCardIds.indexOf(srs.cardId);
  if (recentIndex !== -1) {
    // More recent = bigger penalty
    const recencyPenalty = 30 - recentIndex * 5;
    priority -= Math.max(0, recencyPenalty);
  }
  
  return priority;
}

/**
 * Get the next card to review using forgetting curve optimization.
 *
 * Priority:
 * 1. Due cards sorted by priority (urgency + retention + difficulty)
 * 2. New cards (if under daily limit, sorted by createdAt)
 * 3. Loop mode: cards sorted by priority (for continuous learning)
 * 4. null if nothing to review
 */
export function getNextCard(
  index: CardIndex,
  now: number,
  options: SchedulerOptions = {}
): Card | null {
  const { 
    newCardsPerDay = 20, 
    todayNewCardCount = 0,
    loopMode = false,
    excludeCardId,
    recentCardIds = []
  } = options;

  // Build scored list of due cards
  const scoredDueCards: ScoredCard[] = [];
  
  for (const cardId of index.dueCards) {
    if (excludeCardId && cardId === excludeCardId) continue;
    
    const card = index.cards.get(cardId);
    const srs = index.srsStates.get(cardId);
    
    if (card && srs && srs.dueAt <= now && srs.reps > 0) {
      scoredDueCards.push({
        card,
        srs,
        priority: calculatePriority(srs, now, recentCardIds)
      });
    }
  }
  
  // Sort by priority (highest first)
  scoredDueCards.sort((a, b) => b.priority - a.priority);
  
  if (scoredDueCards.length > 0) {
    return scoredDueCards[0].card;
  }

  // Then try new cards if under limit
  if (todayNewCardCount < newCardsPerDay) {
    for (const cardId of index.newCards) {
      if (excludeCardId && cardId === excludeCardId) continue;
      
      const card = index.cards.get(cardId);
      const srs = index.srsStates.get(cardId);

      if (card && srs && srs.reps === 0) {
        return card;
      }
    }
  }

  // Loop mode: return card with highest priority for continuous learning
  if (loopMode && index.cards.size > 0) {
    const scoredAllCards: ScoredCard[] = [];
    
    // Include all cards (both due and not yet due)
    for (const [cardId, card] of index.cards) {
      if (excludeCardId && cardId === excludeCardId) continue;
      
      const srs = index.srsStates.get(cardId);
      
      // Include all cards that have been reviewed at least once
      if (srs && srs.reps > 0) {
        scoredAllCards.push({
          card,
          srs,
          priority: calculatePriority(srs, now, recentCardIds)
        });
      }
    }
    
    // Sort by priority
    scoredAllCards.sort((a, b) => b.priority - a.priority);
    
    if (scoredAllCards.length > 0) {
      return scoredAllCards[0].card;
    }
    
    // Fall back to any card (including new cards in loop)
    for (const [cardId, card] of index.cards) {
      if (excludeCardId && cardId === excludeCardId) continue;
      if (!recentCardIds.includes(cardId)) {
        return card;
      }
    }
    
    // If all cards are recent, return least recent
    for (const [cardId, card] of index.cards) {
      if (excludeCardId && cardId === excludeCardId) continue;
      return card;
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
