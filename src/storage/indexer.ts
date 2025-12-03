// Storage module - Rebuild index from events (event sourcing)
// PURE MODULE: No vscode imports allowed

import type { Card, CardIndex, ReviewEvent, SrsState } from './schema';
import { calculateNextState, createInitialSrsState } from '../srs/sm2';

export const INDEXER_VERSION = 1;

/**
 * Build an index from raw cards and events.
 * - Deduplicates cards by taking the latest version
 * - Excludes soft-deleted cards
 * - Computes SRS state from review events
 * - Categorizes cards into due and new
 */
export function buildIndex(cards: Card[], events: ReviewEvent[]): CardIndex {
  const now = Date.now();

  // Step 1: Get latest version of each card, excluding deleted
  const latestCards = getLatestCards(cards);

  // Step 2: Group events by cardId and sort by timestamp
  const eventsByCard = groupEventsByCard(events);

  // Step 3: Compute SRS state for each card
  const srsStates = new Map<string, SrsState>();
  const dueCards: string[] = [];
  const newCards: string[] = [];

  for (const [cardId, card] of latestCards) {
    const cardEvents = eventsByCard.get(cardId) || [];

    if (cardEvents.length === 0) {
      // New card - never reviewed
      const initialState = createInitialSrsState(cardId);
      initialState.dueAt = card.createdAt; // Due immediately
      srsStates.set(cardId, initialState);
      newCards.push(cardId);
    } else {
      // Compute SRS state by replaying events
      const srsState = computeSrsStateFromEvents(cardId, cardEvents);
      srsStates.set(cardId, srsState);

      // Check if due
      if (srsState.dueAt <= now) {
        dueCards.push(cardId);
      }
    }
  }

  // Sort dueCards by dueAt (earliest first)
  dueCards.sort((a, b) => {
    const srsA = srsStates.get(a);
    const srsB = srsStates.get(b);
    return (srsA?.dueAt || 0) - (srsB?.dueAt || 0);
  });

  // Sort newCards by createdAt (oldest first)
  newCards.sort((a, b) => {
    const cardA = latestCards.get(a);
    const cardB = latestCards.get(b);
    return (cardA?.createdAt || 0) - (cardB?.createdAt || 0);
  });

  return {
    cards: latestCards,
    srsStates,
    dueCards,
    newCards,
  };
}

/**
 * Get cards that are due for review
 */
export function getDueCards(index: CardIndex, now: number): Card[] {
  const dueCards: Card[] = [];

  for (const [cardId, card] of index.cards) {
    const srs = index.srsStates.get(cardId);
    if (srs && srs.dueAt <= now && srs.reps > 0) {
      dueCards.push(card);
    }
  }

  // Sort by dueAt (earliest first)
  dueCards.sort((a, b) => {
    const srsA = index.srsStates.get(a.id);
    const srsB = index.srsStates.get(b.id);
    return (srsA?.dueAt || 0) - (srsB?.dueAt || 0);
  });

  return dueCards;
}

/**
 * Get cards that have never been reviewed (new cards)
 */
export function getNewCards(index: CardIndex): Card[] {
  const newCards: Card[] = [];

  for (const cardId of index.newCards) {
    const card = index.cards.get(cardId);
    if (card) {
      newCards.push(card);
    }
  }

  // Sort by createdAt (oldest first)
  newCards.sort((a, b) => a.createdAt - b.createdAt);

  return newCards;
}

/**
 * Get the latest version of each card, excluding soft-deleted ones
 */
function getLatestCards(cards: Card[]): Map<string, Card> {
  const latest = new Map<string, Card>();

  for (const card of cards) {
    const existing = latest.get(card.id);
    if (!existing || card.version > existing.version) {
      latest.set(card.id, card);
    }
  }

  // Remove soft-deleted cards
  for (const [id, card] of latest) {
    if (card.deleted) {
      latest.delete(id);
    }
  }

  return latest;
}

/**
 * Group events by cardId and sort by timestamp
 */
function groupEventsByCard(events: ReviewEvent[]): Map<string, ReviewEvent[]> {
  const grouped = new Map<string, ReviewEvent[]>();

  for (const event of events) {
    const cardEvents = grouped.get(event.cardId) || [];
    cardEvents.push(event);
    grouped.set(event.cardId, cardEvents);
  }

  // Sort each group by timestamp
  for (const [, cardEvents] of grouped) {
    cardEvents.sort((a, b) => a.ts - b.ts);
  }

  return grouped;
}

/**
 * Compute SRS state by replaying review events
 */
function computeSrsStateFromEvents(cardId: string, events: ReviewEvent[]): SrsState {
  let state = createInitialSrsState(cardId);

  for (const event of events) {
    state = calculateNextState(state, event.rating, event.ts);
  }

  return state;
}
