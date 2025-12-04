// Storage module - Dashboard statistics calculation
// PURE MODULE: No vscode imports allowed

import type { Card, CardIndex, ReviewEvent, DashboardStats, KnowledgeGraph, KnowledgeGraphNode, KnowledgeGraphEdge, SrsState } from './schema';

/**
 * Calculate dashboard statistics from index and events
 */
export function calculateDashboardStats(
  index: CardIndex,
  events: ReviewEvent[]
): DashboardStats {
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);

  // Card counts
  const cards = Array.from(index.cards.values());
  const totalCards = cards.length;

  // Card type distribution
  const cardsByType = { word: 0, phrase: 0, sentence: 0 };
  for (const card of cards) {
    cardsByType[card.type]++;
  }

  // Due and new cards from index
  const dueCards = index.dueCards.length;
  const newCards = index.newCards.length;

  // Learned and mastered cards
  let learnedCards = 0;
  let masteredCards = 0;
  let totalEaseFactor = 0;
  let easeFactorCount = 0;

  for (const [cardId, srs] of index.srsStates) {
    if (srs.reps > 0) {
      learnedCards++;
      totalEaseFactor += srs.easeFactor;
      easeFactorCount++;

      // Mastered: interval >= 21 days
      if (srs.intervalDays >= 21) {
        masteredCards++;
      }
    }
  }

  // Review statistics
  const totalReviews = events.length;
  const reviewsToday = events.filter(e => e.ts >= todayStart).length;

  // Ratings distribution
  const ratingsDistribution = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const event of events) {
    ratingsDistribution[event.rating]++;
  }

  // Retention rate (good + easy) / total
  const positiveRatings = ratingsDistribution.good + ratingsDistribution.easy;
  const retentionRate = totalReviews > 0 ? positiveRatings / totalReviews : 0;

  // Average ease factor
  const averageEaseFactor = easeFactorCount > 0 ? totalEaseFactor / easeFactorCount : 2.5;

  // Calculate streak
  const currentStreak = calculateStreak(events);

  // Reviews per day (last 90 days for heatmap)
  const reviewsPerDay = calculateReviewsPerDay(events, 90);

  // Retention history (last 30 days rolling window)
  const retentionHistory = calculateRetentionHistory(events, 30);

  return {
    totalCards,
    dueCards,
    newCards,
    learnedCards,
    masteredCards,
    totalReviews,
    reviewsToday,
    currentStreak,
    averageEaseFactor: Math.round(averageEaseFactor * 100) / 100,
    retentionRate: Math.round(retentionRate * 100) / 100,
    cardsByType,
    ratingsDistribution,
    reviewsPerDay,
    retentionHistory,
  };
}

/**
 * Calculate current streak (consecutive days with reviews)
 */
function calculateStreak(events: ReviewEvent[]): number {
  if (events.length === 0) return 0;

  // Get unique review dates
  const reviewDates = new Set<string>();
  for (const event of events) {
    const date = new Date(event.ts).toISOString().split('T')[0];
    reviewDates.add(date);
  }

  const sortedDates = Array.from(reviewDates).sort().reverse();
  if (sortedDates.length === 0) return 0;

  // Check if today or yesterday has a review
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0; // Streak broken
  }

  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculate reviews per day for the last N days
 */
function calculateReviewsPerDay(events: ReviewEvent[], days: number): Array<{ date: string; count: number }> {
  const result: Array<{ date: string; count: number }> = [];
  const countByDate = new Map<string, number>();

  for (const event of events) {
    const date = new Date(event.ts).toISOString().split('T')[0];
    countByDate.set(date, (countByDate.get(date) || 0) + 1);
  }

  // Generate last N days
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    result.push({
      date,
      count: countByDate.get(date) || 0,
    });
  }

  return result;
}

/**
 * Calculate retention rate history for the last N days
 * Uses a 7-day rolling window for smoothing
 */
function calculateRetentionHistory(events: ReviewEvent[], days: number): Array<{ date: string; rate: number }> {
  const result: Array<{ date: string; rate: number }> = [];

  // Group events by date
  const eventsByDate = new Map<string, ReviewEvent[]>();
  for (const event of events) {
    const date = new Date(event.ts).toISOString().split('T')[0];
    if (!eventsByDate.has(date)) {
      eventsByDate.set(date, []);
    }
    eventsByDate.get(date)!.push(event);
  }

  // Calculate retention for each day using 7-day rolling window
  for (let i = days - 1; i >= 0; i--) {
    const endDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const date = endDate.toISOString().split('T')[0];

    // Collect events from past 7 days (rolling window)
    let positiveCount = 0;
    let totalCount = 0;

    for (let j = 0; j < 7; j++) {
      const windowDate = new Date(endDate.getTime() - j * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dayEvents = eventsByDate.get(windowDate) || [];

      for (const event of dayEvents) {
        totalCount++;
        if (event.rating === 'good' || event.rating === 'easy') {
          positiveCount++;
        }
      }
    }

    const rate = totalCount > 0 ? positiveCount / totalCount : 0;
    result.push({ date, rate: Math.round(rate * 100) / 100 });
  }

  return result;
}

/**
 * Generate knowledge graph from cards and their tag relationships
 * - Only tag relationships are shown (no synonyms/antonyms)
 * - Node size is based on review count (reps)
 * - Node color is based on ease factor (ef)
 */
export function generateKnowledgeGraph(
  index: CardIndex,
  options: {
    maxNodes?: number;
    includeOrphans?: boolean;
    filterTag?: string;
  } = {}
): KnowledgeGraph {
  const { maxNodes = 100, includeOrphans = false, filterTag } = options;

  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraphEdge[] = [];
  const nodeIds = new Set<string>();

  // Filter cards
  let cards = Array.from(index.cards.values());
  if (filterTag) {
    cards = cards.filter(c => c.tags?.includes(filterTag));
  }

  // Calculate mastery level from SRS state
  const getMasteryLevel = (cardId: string): number => {
    const srs = index.srsStates.get(cardId);
    if (!srs || srs.reps === 0) return 0;

    if (srs.intervalDays >= 21) return 5;
    if (srs.intervalDays >= 14) return 4;
    if (srs.intervalDays >= 7) return 3;
    if (srs.intervalDays >= 3) return 2;
    return 1;
  };

  // Get SRS data for node visualization
  const getSrsData = (cardId: string): { reps: number; ef: number } => {
    const srs = index.srsStates.get(cardId);
    return {
      reps: srs?.reps ?? 0,
      ef: srs?.easeFactor ?? 2.5, // Default EF for new cards
    };
  };

  // Track connections for orphan filtering (only count tags now)
  const connectionCount = new Map<string, number>();

  for (const card of cards) {
    const connections = card.tags?.length ?? 0;
    connectionCount.set(card.id, connections);
  }

  // Sort by connections (most connected first)
  cards.sort((a, b) => (connectionCount.get(b.id) || 0) - (connectionCount.get(a.id) || 0));

  // Filter orphans if requested
  if (!includeOrphans) {
    cards = cards.filter(c => (connectionCount.get(c.id) || 0) > 0);
  }

  // Limit nodes
  cards = cards.slice(0, maxNodes);

  // Add card nodes
  for (const card of cards) {
    const masteryLevel = getMasteryLevel(card.id);
    const { reps, ef } = getSrsData(card.id);

    nodes.push({
      id: card.id,
      label: card.front.term,
      type: 'card',
      masteryLevel,
      reps,
      ef,
      weight: 1 + (connectionCount.get(card.id) || 0) * 0.2,
    });
    nodeIds.add(card.id);
  }

  // Helper to generate consistent ID for tag nodes
  const getTagId = (tag: string): string => {
    return `tag:${tag.toLowerCase()}`;
  };

  // Add tag relationships only
  for (const card of cards) {
    if (card.tags) {
      for (const tag of card.tags) {
        const tagId = getTagId(tag);

        if (!nodeIds.has(tagId)) {
          nodes.push({
            id: tagId,
            label: `#${tag}`,
            type: 'tag',
            weight: 0.8,
          });
          nodeIds.add(tagId);
        }

        edges.push({
          source: card.id,
          target: tagId,
          type: 'tag',
          weight: 0.5,
        });
      }
    }
  }

  return {
    nodes,
    edges,
    meta: {
      totalCards: cards.length,
      totalConnections: edges.length,
      generatedAt: Date.now(),
    },
  };
}
